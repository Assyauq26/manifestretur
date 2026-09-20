/**
 * MANIFEST RETUR - GOOGLE APPS SCRIPT BACKEND
 *
 * Phase 1-6: database/API, seller, manifest and AWB.
 * PDF generation is owned exclusively by PdfTemplateOverride.gs.
 * Handover routing is owned by Handover.gs.
 */

const PHASE7_READY_STATUS = 'READY_HANDOVER';
const PHASE7_COMPLETED_STATUS = 'COMPLETED';

function doOptions(e) {
  return createJsonResponse({
    success: true,
    message: 'CORS OK'
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createErrorResponse('Request body tidak ditemukan.', 400);
    }

    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;

    switch (action) {
      case 'ping':
        return createJsonResponse({
          success: true,
          message: 'API is online'
        });
      case 'login':
        return handleLogin(requestData);
      case 'getSellers':
        return handleGetSellers(requestData);
      case 'generateManifest':
        return handleGenerateManifest(requestData);
      case 'getReadyHandover':
        return handleGetReadyHandoverV2(requestData);
      case 'completeHandover':
        return handleCompleteHandoverV2(requestData);
      default:
        return createErrorResponse('Action tidak dikenal: ' + action, 400);
    }
  } catch (error) {
    return createErrorResponse('Server error: ' + error.message, 500);
  }
}

function doGet(e) {
  return createJsonResponse({
    success: true,
    message: 'API Running'
  });
}

function handleGetSellers(requestData) {
  const user = getSessionUserForManifest_(requestData && requestData.userToken);
  if (!user) return createErrorResponse('Sesi tidak valid.', 401);

  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName('SELLER_MASTER');

  if (!sheet) {
    return createErrorResponse('Sheet SELLER_MASTER tidak ditemukan.', 500);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return createJsonResponse({ success: true, data: [] });
  }

  const headers = data[0].map(String);
  const idx = indexHeaders_(headers, [
    'seller_id', 'seller_name', 'receiver_name', 'phone', 'status'
  ], 'SELLER_MASTER');

  const sellers = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[idx.status] || '').trim().toUpperCase() !== 'ACTIVE') continue;

    sellers.push({
      seller_id: row[idx.seller_id],
      seller_name: row[idx.seller_name],
      receiver_name: row[idx.receiver_name],
      phone: row[idx.phone]
    });
  }

  return createJsonResponse({ success: true, data: sellers });
}

function handleGenerateManifest(requestData) {
  let lock;

  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const manifestSheet = ss.getSheetByName('MANIFEST');
    const awbSheet = ss.getSheetByName('MANIFEST_AWB');
    const sellerSheet = ss.getSheetByName('SELLER_MASTER');

    if (!manifestSheet || !awbSheet || !sellerSheet) {
      return createErrorResponse('Tabel database belum lengkap.', 500);
    }

    const shift = String(requestData.shift || '').trim();
    const sellerId = String(requestData.sellerId || '').trim();
    const awbs = Array.isArray(requestData.awbs)
      ? requestData.awbs.map(function(awb) { return String(awb || '').trim().toUpperCase(); }).filter(Boolean)
      : [];
    const userToken = requestData.userToken;

    if (!['1', '2', '3'].includes(shift)) {
      return createErrorResponse('Shift tidak valid.');
    }

    if (!sellerId) {
      return createErrorResponse('Seller wajib dipilih.');
    }

    if (awbs.length === 0) {
      return createErrorResponse('Daftar AWB tidak boleh kosong.');
    }

    const user = getSessionUserForManifest_(userToken);
    if (!user) return createErrorResponse('Session expired. Silakan login kembali.', 401);

    const sellerData = sellerSheet.getDataRange().getValues();
    if (sellerData.length < 2) return createErrorResponse('Data seller kosong.');

    const sellerHeaders = sellerData[0].map(String);
    const sellerIdx = indexHeaders_(sellerHeaders, [
      'seller_id', 'seller_name', 'receiver_name', 'phone', 'status'
    ], 'SELLER_MASTER');

    let sellerInfo = null;
    for (let i = 1; i < sellerData.length; i++) {
      if (
        String(sellerData[i][sellerIdx.seller_id] || '').trim() === sellerId &&
        String(sellerData[i][sellerIdx.status] || '').trim().toUpperCase() === 'ACTIVE'
      ) {
        sellerInfo = sellerData[i];
        break;
      }
    }

    if (!sellerInfo) {
      return createErrorResponse('Seller tidak ditemukan atau tidak aktif.');
    }

    const sellerName = String(sellerInfo[sellerIdx.seller_name] || '').trim();
    const receiverName = String(sellerInfo[sellerIdx.receiver_name] || '-').trim();
    const sellerPhone = String(sellerInfo[sellerIdx.phone] || '-').trim();
    const today = new Date();

    const dateString = Utilities.formatDate(today, 'Asia/Jakarta', 'yyyyMMdd');
    const prefix = 'MR-' + String(user.drop_point_id || '').trim() + '-';
    const sequencePrefix = 'MR-' + dateString + '-' + String(user.drop_point_id || '').trim() + '-';

    const manifestData = manifestSheet.getDataRange().getValues();
    const manifestHeaders = manifestData.length ? manifestData[0].map(String) : [];
    const manifestIdx = indexHeaders_(manifestHeaders, [
      'manifest_id', 'manifest_number', 'manifest_date', 'shift', 'shift_name',
      'drop_point_id', 'drop_point_name', 'sprinter_id', 'sprinter_name', 'sprinter_phone',
      'seller_id', 'seller_name', 'receiver_name', 'receiver_phone', 'total_awb',
      'status', 'pdf_file_id', 'pdf_url', 'created_at', 'created_by', 'updated_at',
      'updated_by', 'generated_at', 'handover_at', 'completed_at'
    ], 'MANIFEST');

    let maxSeq = 0;
    for (let i = 1; i < manifestData.length; i++) {
      const number = String(manifestData[i][manifestIdx.manifest_number] || '').trim();
      if (!number.startsWith(sequencePrefix)) continue;

      const parts = number.split('-');
      const sequence = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(sequence) && sequence > maxSeq) maxSeq = sequence;
    }

    const nextSeq = String(maxSeq + 1).padStart(3, '0');
    const manifestNumber = sequencePrefix + nextSeq;
    const manifestId = Utilities.getUuid();
    const shiftName = shift === '1' ? 'Pagi' : shift === '2' ? 'Siang' : 'Sore';

    const pdfResult = generatePdfDrive(
      manifestNumber,
      user,
      sellerName,
      receiverName,
      sellerPhone,
      awbs
    );

    const manifestRow = new Array(manifestHeaders.length).fill('');
    manifestRow[manifestIdx.manifest_id] = manifestId;
    manifestRow[manifestIdx.manifest_number] = manifestNumber;
    manifestRow[manifestIdx.manifest_date] = today;
    manifestRow[manifestIdx.shift] = shift;
    manifestRow[manifestIdx.shift_name] = shiftName;
    manifestRow[manifestIdx.drop_point_id] = user.drop_point_id || '';
    manifestRow[manifestIdx.drop_point_name] = 'Nama DP Temp';
    manifestRow[manifestIdx.sprinter_id] = user.sprinter_id || '';
    manifestRow[manifestIdx.sprinter_name] = user.nama_sprinter || '';
    manifestRow[manifestIdx.sprinter_phone] = user.no_hp || '';
    manifestRow[manifestIdx.seller_id] = sellerId;
    manifestRow[manifestIdx.seller_name] = sellerName;
    manifestRow[manifestIdx.receiver_name] = receiverName;
    manifestRow[manifestIdx.receiver_phone] = sellerPhone;
    manifestRow[manifestIdx.total_awb] = awbs.length;
    manifestRow[manifestIdx.status] = PHASE7_READY_STATUS;
    manifestRow[manifestIdx.pdf_file_id] = pdfResult.id;
    manifestRow[manifestIdx.pdf_url] = pdfResult.url;
    manifestRow[manifestIdx.created_at] = today;
    manifestRow[manifestIdx.created_by] = user.sprinter_id || '';
    manifestRow[manifestIdx.updated_at] = today;
    manifestRow[manifestIdx.updated_by] = user.sprinter_id || '';
    manifestRow[manifestIdx.generated_at] = today;

    manifestSheet.appendRow(manifestRow);

    const awbSheetValues = awbSheet.getDataRange().getValues();
    const awbHeaders = awbSheetValues.length ? awbSheetValues[0].map(String) : [];
    const awbIdx = indexHeaders_(awbHeaders, [
      'manifest_awb_id', 'manifest_id', 'awb', 'sequence', 'input_method',
      'scanned_at', 'scanned_by', 'status'
    ], 'MANIFEST_AWB');

    const awbRows = awbs.map(function(awb, index) {
      const row = new Array(awbHeaders.length).fill('');
      row[awbIdx.manifest_awb_id] = Utilities.getUuid();
      row[awbIdx.manifest_id] = manifestId;
      row[awbIdx.awb] = awb;
      row[awbIdx.sequence] = index + 1;
      row[awbIdx.input_method] = 'UNKNOWN';
      row[awbIdx.scanned_at] = today;
      row[awbIdx.scanned_by] = user.sprinter_id || '';
      row[awbIdx.status] = 'ACTIVE';
      return row;
    });

    if (awbRows.length > 0) {
      const startRow = awbSheet.getLastRow() + 1;
      awbSheet.getRange(startRow, 1, awbRows.length, awbRows[0].length).setValues(awbRows);
    }

    return createJsonResponse({
      success: true,
      message: 'Manifest berhasil dibuat.',
      data: {
        manifestId: manifestId,
        manifestNumber: manifestNumber,
        pdfUrl: pdfResult.url,
        status: PHASE7_READY_STATUS
      }
    });
  } catch (error) {
    return createErrorResponse(error.message || 'Gagal membuat manifest.', 500);
  } finally {
    if (lock) lock.releaseLock();
  }
}

function getSessionUserForManifest_(token) {
  if (!token) throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
  const raw = CacheService.getScriptCache().get(String(token));
  if (!raw) throw new Error('Sesi telah berakhir. Silakan login kembali.');

  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error('Data sesi tidak valid. Silakan login kembali.');
  }
}

function indexHeaders_(headers, required, sheetName) {
  const map = {};
  headers.forEach(function(header, i) {
    map[String(header || '').trim().toLowerCase().replace(/\s+/g, '_')] = i;
  });

  required.forEach(function(key) {
    if (map[key] === undefined) {
      throw new Error('Kolom ' + sheetName + ' wajib: ' + key);
    }
  });

  return map;
}

function getOrCreateFolder(path) {
  const parts = String(path).split('/');
  let currentFolder = DriveApp.getRootFolder();

  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;

    const folders = currentFolder.getFoldersByName(parts[i]);
    if (folders.hasNext()) {
      currentFolder = folders.next();
    } else {
      currentFolder = currentFolder.createFolder(parts[i]);
    }
  }

  return currentFolder;
}

function escapePdfHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createJsonResponse(responseObj) {
  const finalResponse = {
    success: responseObj.success !== undefined ? responseObj.success : true,
    data: responseObj.data !== undefined ? responseObj.data : null,
    message: responseObj.message || ''
  };

  return ContentService
    .createTextOutput(JSON.stringify(finalResponse))
    .setMimeType(ContentService.MimeType.JSON);
}

function createErrorResponse(message, code) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: false,
      data: null,
      message: message || 'Terjadi kesalahan.',
      code: code || 400
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
