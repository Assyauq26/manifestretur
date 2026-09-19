/**
 * MANIFEST RETUR - GOOGLE APPS SCRIPT BACKEND
 * Phase 1-6 existing backend + Phase 7 Hand Over & Evidence Capture.
 * Source: existing Kode.gs supplied for this project.
 */

const PHASE7_ROOT_FOLDER = 'MANIFEST_RETUR';
const PHASE7_EVIDENCE_FOLDER = 'HANDOVER';
const PHASE7_READY_STATUS = 'READY_HANDOVER';
const PHASE7_COMPLETED_STATUS = 'COMPLETED';

function doOptions(e) {
  return createJsonResponse({ success: true, message: 'CORS OK' });
}

function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;

    switch (action) {
      case 'ping': return createJsonResponse({ success: true, message: 'API is online' });
      case 'login': return handleLogin(requestData);
      case 'getSellers': return handleGetSellers();
      case 'generateManifest': return handleGenerateManifest(requestData);
      case 'getReadyHandover': return handleGetReadyHandover(requestData);
      case 'completeHandover': return handleCompleteHandover(requestData);
      default: return createErrorResponse(`Action tidak dikenal: ${action}`, 400);
    }
  } catch (error) {
    return createErrorResponse(`Server error: ${error.message}`, 500);
  }
}

function doGet(e) {
  return createJsonResponse({ success: true, message: 'API Running' });
}

// --- LOGIN ---
function handleLogin(requestData) {
  const { username, password } = requestData;
  if (!username || !password) return createErrorResponse('Username dan password harus diisi.');

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SPRINTER_MASTER');
  if (!sheet) return createErrorResponse('Database belum siap.', 500);

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return createErrorResponse('Database kosong.', 401);
  const headers = data[0];
  let foundUser = null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[headers.indexOf('username')].toString() === username.toString() &&
        row[headers.indexOf('password_hash')].toString() === password.toString()) {
      if (row[headers.indexOf('status')] !== 'ACTIVE') return createErrorResponse('Akun Anda tidak aktif.');
      foundUser = {
        sprinter_id: row[headers.indexOf('sprinter_id')],
        employee_code: row[headers.indexOf('employee_code')],
        nama_sprinter: row[headers.indexOf('nama_sprinter')],
        no_hp: row[headers.indexOf('no_hp')],
        drop_point_id: row[headers.indexOf('drop_point_id')],
        role: row[headers.indexOf('role')]
      };
      break;
    }
  }
  if (!foundUser) return createErrorResponse('Username atau password salah.', 401);

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(token, JSON.stringify(foundUser), 21600);
  return createJsonResponse({ success: true, message: 'Login berhasil', data: { user: foundUser, token: token } });
}

// --- GET SELLERS ---
function handleGetSellers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SELLER_MASTER');
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return createJsonResponse({ success: true, data: [] });
  const headers = data[0];
  const sellers = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[headers.indexOf('status')] === 'ACTIVE') {
      sellers.push({
        seller_id: row[headers.indexOf('seller_id')],
        seller_name: row[headers.indexOf('seller_name')],
        receiver_name: row[headers.indexOf('receiver_name')],
        phone: row[headers.indexOf('phone')]
      });
    }
  }
  return createJsonResponse({ success: true, data: sellers });
}

// --- GENERATE MANIFEST & PDF ---
function handleGenerateManifest(requestData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const manifestSheet = ss.getSheetByName('MANIFEST');
  const awbSheet = ss.getSheetByName('MANIFEST_AWB');
  const sellerSheet = ss.getSheetByName('SELLER_MASTER');

  if (!manifestSheet || !awbSheet) return createErrorResponse('Tabel database belum lengkap.');

  const { shift, sellerId, awbs, userToken } = requestData;
  if (!awbs || awbs.length === 0) return createErrorResponse('Daftar AWB tidak boleh kosong.');

  const cachedUser = CacheService.getScriptCache().get(userToken);
  if (!cachedUser) return createErrorResponse('Session expired. Silakan login kembali.', 401);
  const user = JSON.parse(cachedUser);

  const sellerData = sellerSheet.getDataRange().getValues();
  const sHeaders = sellerData[0];
  let sellerInfo = null;
  for (let i = 1; i < sellerData.length; i++) {
    if (sellerData[i][sHeaders.indexOf('seller_id')] === sellerId) {
      sellerInfo = sellerData[i];
      break;
    }
  }

  const sellerName = sellerInfo ? sellerInfo[sHeaders.indexOf('seller_name')] : 'Unknown Seller';
  const receiverName = sellerInfo ? sellerInfo[sHeaders.indexOf('receiver_name')] : '-';
  const sellerPhone = sellerInfo ? sellerInfo[sHeaders.indexOf('phone')] : '-';

  const today = new Date();
  const dateString = Utilities.formatDate(today, 'Asia/Jakarta', 'yyyyMMdd');
  const prefix = `MR-${dateString}-${user.drop_point_id}-`;

  let maxSeq = 0;
  const mData = manifestSheet.getDataRange().getValues();
  if (mData.length > 1) {
    const mNumIdx = mData[0].indexOf('manifest_number');
    for (let i = mData.length - 1; i > 0; i--) {
      const num = mData[i][mNumIdx];
      if (num && num.toString().startsWith(prefix)) {
        const parts = num.toString().split('-');
        const seq = parseInt(parts[parts.length - 1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  const manifestNumber = prefix + nextSeq;
  const manifestId = Utilities.getUuid();
  const shiftName = shift === '1' ? 'Pagi' : (shift === '2' ? 'Siang' : 'Sore');
  const totalAwb = awbs.length;

  const pdfResult = generatePdfDrive(manifestNumber, user, sellerName, receiverName, sellerPhone, awbs);

  manifestSheet.appendRow([
    manifestId, manifestNumber, today, shift, shiftName,
    user.drop_point_id, 'Nama DP Temp', user.sprinter_id, user.nama_sprinter, user.no_hp,
    sellerId, sellerName, receiverName, sellerPhone, totalAwb,
    'READY_HANDOVER', pdfResult.id, pdfResult.url, today, user.sprinter_id, today,
    user.sprinter_id, today, '', ''
  ]);

  if (totalAwb > 0) {
    const awbRows = awbs.map((awb, index) => [
      Utilities.getUuid(), manifestId, awb, index + 1, 'UNKNOWN', today, user.sprinter_id, 'ACTIVE'
    ]);
    const startRow = awbSheet.getLastRow() + 1;
    awbSheet.getRange(startRow, 1, awbRows.length, awbRows[0].length).setValues(awbRows);
  }

  return createJsonResponse({
    success: true,
    data: { manifestNumber: manifestNumber, pdfUrl: pdfResult.url }
  });
}

// --- PHASE 7: READY HANDOVER ---
function handleGetReadyHandover(requestData) {
  const user = requireSessionUser_(requestData && requestData.userToken);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('MANIFEST');
  if (!sheet) return createErrorResponse('Sheet MANIFEST tidak ditemukan.', 500);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return createJsonResponse({ success: true, data: [] });

  const headers = values[0].map(String);
  const idx = buildManifestHeaderMap_(headers);
  const result = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const status = String(row[idx.status] == null ? '' : row[idx.status]).trim().toUpperCase();
    if (status !== PHASE7_READY_STATUS) continue;

    const sameSprinter = valuesEqual_(row[idx.sprinter_id], user.sprinter_id);
    const sameDropPoint = valuesEqual_(row[idx.drop_point_id], user.drop_point_id);
    if (String(user.role || '').toUpperCase() !== 'ADMIN' && !sameSprinter && !sameDropPoint) continue;

    result.push({
      manifestNumber: cellValue_(row, idx.manifest_number),
      manifest_number: cellValue_(row, idx.manifest_number),
      manifestId: cellValue_(row, idx.manifest_id),
      sellerName: cellValue_(row, idx.seller_name),
      seller_name: cellValue_(row, idx.seller_name),
      totalAwb: Number(row[idx.total_awb] || 0),
      total_awb: Number(row[idx.total_awb] || 0),
      shift: cellValue_(row, idx.shift_name) || cellValue_(row, idx.shift),
      status: status,
      manifestDate: isoDate_(row[idx.manifest_date])
    });
  }

  return createJsonResponse({ success: true, data: result });
}

// --- PHASE 7: COMPLETE HANDOVER ---
function handleCompleteHandover(requestData) {
  const user = requireSessionUser_(requestData && requestData.userToken);
  const manifestNumber = String(requestData && requestData.manifestNumber || '').trim();
  if (!manifestNumber) return createErrorResponse('Nomor manifest wajib diisi.');
  if (!requestData.photoBase64) return createErrorResponse('Foto bukti serah terima wajib diisi.');
  if (!requestData.signatureBase64) return createErrorResponse('Tanda tangan PIC Seller wajib diisi.');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('MANIFEST');
    if (!sheet) return createErrorResponse('Sheet MANIFEST tidak ditemukan.', 500);

    let values = sheet.getDataRange().getValues();
    if (values.length < 2) return createErrorResponse('Manifest tidak ditemukan.');

    let headers = values[0].map(String);
    ensureHandoverColumns_(sheet, headers);
    values = sheet.getDataRange().getValues();
    headers = values[0].map(String);
    const idx = buildManifestHeaderMap_(headers);

    let rowNumber = -1;
    let row = null;
    for (let r = 1; r < values.length; r++) {
      if (String(values[r][idx.manifest_number] || '').trim() === manifestNumber) {
        rowNumber = r + 1;
        row = values[r];
        break;
      }
    }

    if (rowNumber < 0) return createErrorResponse('Manifest ' + manifestNumber + ' tidak ditemukan.');

    const currentStatus = String(row[idx.status] || '').trim().toUpperCase();
    if (currentStatus !== PHASE7_READY_STATUS) {
      return createErrorResponse('Manifest tidak dapat diserahkan. Status saat ini: ' + (currentStatus || 'KOSONG'));
    }

    const sameSprinter = valuesEqual_(row[idx.sprinter_id], user.sprinter_id);
    const sameDropPoint = valuesEqual_(row[idx.drop_point_id], user.drop_point_id);
    if (String(user.role || '').toUpperCase() !== 'ADMIN' && !sameSprinter && !sameDropPoint) {
      return createErrorResponse('Anda tidak memiliki akses ke manifest ini.', 403);
    }

    const now = new Date();
    const folder = getHandoverEvidenceFolder_(now, manifestNumber);
    const photoFile = saveBase64Evidence_(requestData.photoBase64, folder, manifestNumber + '_bukti');
    const signatureFile = saveBase64Evidence_(requestData.signatureBase64, folder, manifestNumber + '_signature');

    sheet.getRange(rowNumber, idx.status + 1).setValue(PHASE7_COMPLETED_STATUS);
    sheet.getRange(rowNumber, idx.handover_at + 1).setValue(now);
    sheet.getRange(rowNumber, idx.handover_by + 1).setValue(requestData.handoverBy || user.nama_sprinter || user.sprinter_id || '');
    sheet.getRange(rowNumber, idx.handover_photo_url + 1).setValue(photoFile.getUrl());
    sheet.getRange(rowNumber, idx.handover_signature_url + 1).setValue(signatureFile.getUrl());

    return createJsonResponse({
      success: true,
      message: 'Serah terima berhasil diselesaikan.',
      data: {
        manifestNumber: manifestNumber,
        status: PHASE7_COMPLETED_STATUS,
        handoverAt: now.toISOString(),
        photoUrl: photoFile.getUrl(),
        signatureUrl: signatureFile.getUrl()
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function requireSessionUser_(token) {
  if (!token) throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
  const raw = CacheService.getScriptCache().get(String(token));
  if (!raw) throw new Error('Sesi telah berakhir. Silakan login kembali.');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error('Data sesi tidak valid. Silakan login kembali.');
  }
}

function buildManifestHeaderMap_(headers) {
  const normalized = {};
  headers.forEach(function(h, i) {
    normalized[String(h || '').trim().toLowerCase().replace(/\s+/g, '_')] = i;
  });

  const aliases = {
    manifest_id: ['manifest_id', 'id'],
    manifest_number: ['manifest_number', 'manifest_no', 'nomor_manifest'],
    manifest_date: ['manifest_date', 'date', 'tanggal'],
    shift: ['shift'],
    shift_name: ['shift_name', 'shift_label'],
    drop_point_id: ['drop_point_id', 'drop_point'],
    sprinter_id: ['sprinter_id', 'sprinter'],
    seller_name: ['seller_name', 'seller'],
    total_awb: ['total_awb', 'awb_count', 'jumlah_awb'],
    status: ['status'],
    handover_at: ['handover_at'],
    handover_by: ['handover_by'],
    handover_photo_url: ['handover_photo_url'],
    handover_signature_url: ['handover_signature_url']
  };

  Object.keys(aliases).forEach(function(canonical) {
    if (normalized[canonical] !== undefined) return;
    for (let i = 0; i < aliases[canonical].length; i++) {
      const alias = aliases[canonical][i];
      if (normalized[alias] !== undefined) {
        normalized[canonical] = normalized[alias];
        break;
      }
    }
  });

  ['manifest_number', 'status', 'sprinter_id', 'drop_point_id'].forEach(function(required) {
    if (normalized[required] === undefined) throw new Error('Kolom MANIFEST wajib: ' + required);
  });

  return normalized;
}

function ensureHandoverColumns_(sheet, currentHeaders) {
  const required = ['handover_at', 'handover_by', 'handover_photo_url', 'handover_signature_url'];
  const existing = currentHeaders.map(function(h) { return String(h).trim().toLowerCase(); });
  const missing = required.filter(function(h) { return existing.indexOf(h) === -1; });
  if (!missing.length) return;
  sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
}

function getHandoverEvidenceFolder_(date, manifestNumber) {
  const root = getOrCreateFolderByIterator_(DriveApp.getFoldersByName(PHASE7_ROOT_FOLDER), PHASE7_ROOT_FOLDER, null);
  const handover = getOrCreateFolderByIterator_(root.getFoldersByName(PHASE7_EVIDENCE_FOLDER), PHASE7_EVIDENCE_FOLDER, root);
  const yearName = Utilities.formatDate(date, 'Asia/Jakarta', 'yyyy');
  const monthName = Utilities.formatDate(date, 'Asia/Jakarta', 'MM');
  const dayName = Utilities.formatDate(date, 'Asia/Jakarta', 'dd');
  const year = getOrCreateFolderByIterator_(handover.getFoldersByName(yearName), yearName, handover);
  const month = getOrCreateFolderByIterator_(year.getFoldersByName(monthName), monthName, year);
  const day = getOrCreateFolderByIterator_(month.getFoldersByName(dayName), dayName, month);
  return getOrCreateFolderByIterator_(day.getFoldersByName(manifestNumber), manifestNumber, day);
}

function getOrCreateFolderByIterator_(iterator, name, parent) {
  if (iterator.hasNext()) return iterator.next();
  return parent ? parent.createFolder(name) : DriveApp.createFolder(name);
}

function saveBase64Evidence_(dataUrl, folder, baseName) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Format evidence base64 tidak valid.');

  const mime = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  let extension = 'jpg';
  if (mime === 'image/png') extension = 'png';
  if (mime === 'image/webp') extension = 'webp';
  const blob = Utilities.newBlob(bytes, mime, baseName + '.' + extension);
  return folder.createFile(blob);
}

function valuesEqual_(a, b) {
  return String(a == null ? '' : a).trim().toLowerCase() === String(b == null ? '' : b).trim().toLowerCase();
}

function cellValue_(row, index) {
  return index === undefined ? '' : String(row[index] == null ? '' : row[index]);
}

function isoDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value.toISOString();
  return String(value);
}

// --- FOLDER MANAGEMENT & PDF ---
function getOrCreateFolder(path) {
  const parts = path.split('/');
  let currentFolder = DriveApp.getRootFolder();
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    const folders = currentFolder.getFoldersByName(parts[i]);
    if (folders.hasNext()) currentFolder = folders.next();
    else currentFolder = currentFolder.createFolder(parts[i]);
  }
  return currentFolder;
}

function generatePdfDrive(manifestNumber, user, sellerName, receiverName, sellerPhone, awbs) {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd MMMM yyyy');

  let htmlBody = `
    <html><head><style>
      body { font-family: Arial, sans-serif; font-size: 10px; margin: 15px; color: #000; }
      .top-header { display: flex; justify-content: space-between; font-size: 9px; margin-bottom: 5px; font-weight: bold; }
      .title { text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
      th, td { border: 1px solid #000; padding: 3px 5px; font-size: 9px; }
      .bg-header { background-color: #b4c6e7; font-weight: bold; }
      .bg-yellow { background-color: #ffd966; text-align: center; font-weight: bold; }
      .info-table td { width: 25%; }
      .note { font-size: 9px; margin-bottom: 8px; }
      .footer-note { font-size: 8px; line-height: 1.3; margin-top: 15px; }
      .sign-table { width: 100%; border: none; margin-top: 25px; }
      .sign-table td { border: none; text-align: center; vertical-align: top; width: 50%; }
    </style></head><body>
      <div class="top-header"><div>System-Based / GunScanner</div><div style="color:#D71920;font-size:12px;font-weight:bold;">J&T EXPRESS</div></div>
      <div style="font-size:10px;margin-bottom:10px;"><strong>HARI/TANGGAL:</strong> ${dateStr}</div>
      <div class="title">FORM RETUR PENGEMBALIAN BARANG SELLER</div>
      <table class="info-table">
        <tr><td class="bg-header">DATA DROPPOINT</td><td class="bg-header">DATA SELLER</td></tr>
        <tr><td><strong>DROPPOINT:</strong> ${user.drop_point_id}</td><td><strong>NAMA SELLER DI SISTEM:</strong> ${sellerName}</td></tr>
        <tr><td><strong>NAMA LENGKAP SPRINTER:</strong> ${user.nama_sprinter}</td><td><strong>NAMA PENERIMA:</strong> ${receiverName}</td></tr>
        <tr><td><strong>NO HP SPRINTER:</strong> ${user.no_hp}</td><td><strong>NO HP:</strong> ${sellerPhone}</td></tr>
      </table>
      <div class="note">Keterangan: Paket sudah diserahkan ke PIC Seller.</div>
      <table><tr>
        <th class="bg-yellow" style="width:4%">NO</th><th class="bg-yellow" style="width:21%">AWB</th>
        <th class="bg-yellow" style="width:4%">NO</th><th class="bg-yellow" style="width:21%">AWB</th>
        <th class="bg-yellow" style="width:4%">NO</th><th class="bg-yellow" style="width:21%">AWB</th>
        <th class="bg-yellow" style="width:4%">NO</th><th class="bg-yellow" style="width:21%">AWB</th>
      </tr>`;

  const colCount = 4;
  const rowCount = Math.ceil(awbs.length / colCount);
  const totalRows = Math.max(rowCount, 10);
  for (let i = 0; i < totalRows; i++) {
    htmlBody += '<tr>';
    for (let c = 0; c < colCount; c++) {
      const itemIndex = (i * colCount) + c;
      const currentAwb = awbs[itemIndex] || '';
      const displayNo = itemIndex < awbs.length ? (itemIndex + 1) : '';
      htmlBody += `<td style="text-align:center;background-color:#f9f9f9;">${displayNo}</td><td>${currentAwb}</td>`;
    }
    htmlBody += '</tr>';
  }

  htmlBody += `
      </table>
      <div style="font-weight:bold;margin-bottom:10px;font-size:10px;">TOTAL barang yang telah dikembalikan: ${awbs.length} AWB</div>
      <div class="footer-note">Diatas adalah Data No AWB yang telah kami serahkan kepada PIC Seller.<br>Form ini sebagai bukti untuk serah terima barang yang telah diretur oleh sprinter DP.<br>Semarang, ....................................................</div>
      <table class="sign-table"><tr>
        <td><strong>Yang Membuat</strong><br><br><br><br><strong>(${user.nama_sprinter})</strong><br><span style="font-size:8px;">SPV DP / ADMIN / SPRINTER</span></td>
        <td><strong>Yang Menerima</strong><br><br><br><br><strong>( _________________________________ )</strong><br><span style="font-size:8px;">(PIC Seller) / Penanggung Jawab</span></td>
      </tr></table>
    </body></html>`;

  const blob = Utilities.newBlob(htmlBody, MimeType.HTML).setName(manifestNumber + '.pdf').getAs(MimeType.PDF);
  const year = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy');
  const month = Utilities.formatDate(now, 'Asia/Jakarta', 'MM');
  const day = Utilities.formatDate(now, 'Asia/Jakarta', 'dd');
  const targetFolder = getOrCreateFolder(`MANIFEST_RETUR/PDF/${year}/${month}/${day}`);
  const file = targetFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { id: file.getId(), url: file.getUrl() };
}

// --- RESPONSE HELPERS ---
function createJsonResponse(responseObj) {
  const finalResponse = {
    success: responseObj.success !== undefined ? responseObj.success : true,
    data: responseObj.data || null,
    message: responseObj.message || ''
  };
  return ContentService.createTextOutput(JSON.stringify(finalResponse)).setMimeType(ContentService.MimeType.JSON);
}

function createErrorResponse(message, code) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, data: null, message: message })).setMimeType(ContentService.MimeType.JSON);
}
