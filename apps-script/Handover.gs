/**
 * PHASE 7: HANDOVER
 * Canonical PHOTO + PIC SELLER receiver name + handwritten signature flow.
 * The final manifest PDF is regenerated with the signature on page 1 and
 * the handover photo on the final page. Photo/signature are not stored as
 * separate Drive files.
 */

const HANDOVER_READY_STATUS = 'READY_HANDOVER';
const HANDOVER_COMPLETED_STATUS = 'COMPLETED';

function handleGetReadyHandoverV2(requestData) {
  try {
    const user = getSessionUserForHandover_(requestData && requestData.userToken);
    const sheet = getRequiredSheetForHandover_('MANIFEST');
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return createJsonResponse({ success: true, data: [] });

    const headers = values[0].map(String);
    const idx = headerIndexForHandover_(headers);
    const isAdmin = String(user.role || '').trim().toUpperCase() === 'ADMIN';
    const result = [];

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const status = String(row[idx.status] || '').trim().toUpperCase();
      if (status !== HANDOVER_READY_STATUS) continue;

      const allowed = isAdmin ||
        sameValueForHandover_(row[idx.sprinter_id], user.sprinter_id) ||
        sameValueForHandover_(row[idx.drop_point_id], user.drop_point_id);
      if (!allowed) continue;

      result.push({
        manifestId: String(row[idx.manifest_id] || ''),
        manifestNumber: String(row[idx.manifest_number] || ''),
        manifestDate: handoverDateValue_(row[idx.manifest_date]),
        shift: String(row[idx.shift_name] || row[idx.shift] || ''),
        dropPointId: String(row[idx.drop_point_id] || ''),
        sprinterName: String(row[idx.sprinter_name] || ''),
        sellerId: String(row[idx.seller_id] || ''),
        sellerName: String(row[idx.seller_name] || ''),
        receiverName: String(row[idx.receiver_name] || ''),
        totalAwb: Number(row[idx.total_awb] || 0),
        status: status,
        pdfUrl: String(row[idx.pdf_url] || '')
      });
    }

    return createJsonResponse({ success: true, data: result });
  } catch (error) {
    return createErrorResponse(error.message || 'Gagal mengambil manifest handover.', 401);
  }
}

function handleCompleteHandoverV2(requestData) {
  let lock;
  try {
    const user = getSessionUserForHandover_(requestData && requestData.userToken);
    const manifestNumber = String(requestData && requestData.manifestNumber || '').trim();
    const photoBase64 = String(requestData && requestData.photoBase64 || '').trim();
    const receiverName = String(requestData && requestData.receiverName || '').trim();
    const signatureData = String(requestData && requestData.signatureData || '').trim();

    if (!manifestNumber) return createErrorResponse('Nomor manifest wajib diisi.');
    if (!receiverName) return createErrorResponse('Nama penerima PIC Seller wajib diisi.');
    if (!photoBase64) return createErrorResponse('Foto bukti serah terima wajib diambil.');
    if (!signatureData) return createErrorResponse('Tanda tangan PIC Seller wajib diisi.');

    validateHandoverPhoto_(photoBase64);
    validateHandoverSignature_(signatureData);

    lock = LockService.getScriptLock();
    lock.waitLock(20000);

    const manifestSheet = getRequiredSheetForHandover_('MANIFEST');
    const handoverSheet = getRequiredSheetForHandover_('HANDOVER');
    const manifestValues = manifestSheet.getDataRange().getValues();
    if (manifestValues.length < 2) return createErrorResponse('Manifest tidak ditemukan.');

    const manifestHeaders = manifestValues[0].map(String);
    const idx = headerIndexForHandover_(manifestHeaders);
    let rowNumber = -1;
    let manifestRow = null;

    for (let r = 1; r < manifestValues.length; r++) {
      if (String(manifestValues[r][idx.manifest_number] || '').trim() === manifestNumber) {
        rowNumber = r + 1;
        manifestRow = manifestValues[r];
        break;
      }
    }

    if (rowNumber < 0) return createErrorResponse('Manifest ' + manifestNumber + ' tidak ditemukan.');

    const status = String(manifestRow[idx.status] || '').trim().toUpperCase();
    if (status !== HANDOVER_READY_STATUS) {
      return createErrorResponse('Manifest tidak dapat diserahkan. Status saat ini: ' + (status || 'KOSONG'));
    }

    const isAdmin = String(user.role || '').trim().toUpperCase() === 'ADMIN';
    const allowed = isAdmin ||
      sameValueForHandover_(manifestRow[idx.sprinter_id], user.sprinter_id) ||
      sameValueForHandover_(manifestRow[idx.drop_point_id], user.drop_point_id);
    if (!allowed) return createErrorResponse('Anda tidak memiliki akses ke manifest ini.', 403);

    const now = new Date();
    const manifestId = String(manifestRow[idx.manifest_id] || '').trim();
    const sellerId = String(manifestRow[idx.seller_id] || '').trim();
    const sellerName = String(manifestRow[idx.seller_name] || '').trim();
    const receiverPhone = String(manifestRow[idx.receiver_phone] || '').trim();
    const oldPdfId = String(manifestRow[idx.pdf_file_id] || '').trim();
    const oldPdfUrl = String(manifestRow[idx.pdf_url] || '').trim();
    const handoverBy = String(requestData.handoverBy || user.nama_sprinter || user.sprinter_id || '').trim();

    if (!manifestId) return createErrorResponse('Manifest ID kosong. Data manifest tidak valid.', 500);

    const awbs = getManifestAwbsForHandover_(manifestId);
    if (!awbs.length) return createErrorResponse('AWB manifest tidak ditemukan.');

    const finalPdf = generatePdfDrive(
      manifestNumber,
      user,
      sellerName,
      receiverName,
      receiverPhone,
      awbs,
      {
        handoverPhotoBase64: photoBase64,
        handoverAt: now,
        handoverBy: handoverBy,
        receiverName: receiverName,
        signatureData: signatureData,
        manifestDate: manifestRow[idx.manifest_date]
      }
    );

    const handoverHeaders = handoverSheet.getDataRange().getValues()[0].map(String);
    const hidx = headerIndexForHandoverTable_(handoverHeaders);
    const handoverId = Utilities.getUuid();
    const handoverRow = new Array(handoverHeaders.length).fill('');
    handoverRow[hidx.handover_id] = handoverId;
    handoverRow[hidx.manifest_id] = manifestId;
    handoverRow[hidx.seller_id] = sellerId;
    handoverRow[hidx.seller_name] = sellerName;
    handoverRow[hidx.receiver_name] = receiverName;
    handoverRow[hidx.handover_at] = now;
    handoverRow[hidx.handover_by] = handoverBy;
    if (hidx.photo_file_id !== undefined) handoverRow[hidx.photo_file_id] = '';
    if (hidx.photo_url !== undefined) handoverRow[hidx.photo_url] = '';
    if (hidx.signature_data !== undefined) handoverRow[hidx.signature_data] = signatureData;
    if (hidx.notes !== undefined) handoverRow[hidx.notes] = String(requestData.notes || '');
    handoverRow[hidx.status] = HANDOVER_COMPLETED_STATUS;
    handoverSheet.appendRow(handoverRow);

    manifestSheet.getRange(rowNumber, idx.status + 1).setValue(HANDOVER_COMPLETED_STATUS);
    manifestSheet.getRange(rowNumber, idx.handover_at + 1).setValue(now);
    manifestSheet.getRange(rowNumber, idx.completed_at + 1).setValue(now);
    manifestSheet.getRange(rowNumber, idx.receiver_name + 1).setValue(receiverName);
    manifestSheet.getRange(rowNumber, idx.pdf_file_id + 1).setValue(finalPdf.id);
    manifestSheet.getRange(rowNumber, idx.pdf_url + 1).setValue(finalPdf.url);
    if (idx.updated_at !== undefined) manifestSheet.getRange(rowNumber, idx.updated_at + 1).setValue(now);
    if (idx.updated_by !== undefined) manifestSheet.getRange(rowNumber, idx.updated_by + 1).setValue(handoverBy);

    if (oldPdfId && oldPdfId !== finalPdf.id) {
      try { DriveApp.getFileById(oldPdfId).setTrashed(true); } catch (_) {}
    }

    writeHandoverAuditLog_(user, manifestId, manifestNumber, handoverId, now);

    return createJsonResponse({
      success: true,
      message: 'Serah terima berhasil diselesaikan.',
      data: {
        manifestId: manifestId,
        manifestNumber: manifestNumber,
        handoverId: handoverId,
        status: HANDOVER_COMPLETED_STATUS,
        handoverAt: now.toISOString(),
        receiverName: receiverName,
        pdfUrl: finalPdf.url,
        pdfFileId: finalPdf.id,
        photoUrl: '',
        photoStoredInDrive: false
      }
    });
  } catch (error) {
    return createErrorResponse(error.message || 'Gagal menyelesaikan serah terima.', 500);
  } finally {
    if (lock) lock.releaseLock();
  }
}

function getManifestAwbsForHandover_(manifestId) {
  const sheet = getRequiredSheetForHandover_('MANIFEST_AWB');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  const map = {};
  headers.forEach(function(h, i) {
    map[String(h || '').trim().toLowerCase().replace(/\s+/g, '_')] = i;
  });
  if (map.manifest_id === undefined || map.awb === undefined) return [];

  const rows = [];
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][map.manifest_id] || '').trim() !== String(manifestId).trim()) continue;
    rows.push({ sequence: Number(values[i][map.sequence] || i), awb: String(values[i][map.awb] || '').trim() });
  }
  rows.sort(function(a, b) { return a.sequence - b.sequence; });
  return rows.map(function(item) { return item.awb; }).filter(Boolean);
}

function validateHandoverPhoto_(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new Error('Foto harus berupa JPEG, PNG, atau WebP.');
  const bytes = Utilities.base64Decode(match[2]);
  if (!bytes || bytes.length === 0) throw new Error('Foto bukti serah terima kosong.');
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Ukuran foto terlalu besar. Maksimal 8 MB.');
}

function validateHandoverSignature_(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new Error('Tanda tangan tidak valid.');
  const bytes = Utilities.base64Decode(match[1]);
  if (!bytes || bytes.length === 0) throw new Error('Tanda tangan kosong.');
  if (bytes.length > 2 * 1024 * 1024) throw new Error('Ukuran tanda tangan terlalu besar.');
}

function getSessionUserForHandover_(token) {
  if (!token) throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
  const raw = CacheService.getScriptCache().get(String(token));
  if (!raw) throw new Error('Sesi telah berakhir. Silakan login kembali.');
  try { return JSON.parse(raw); }
  catch (e) { throw new Error('Data sesi tidak valid. Silakan login kembali.'); }
}

function getRequiredSheetForHandover_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Sheet ' + name + ' tidak ditemukan.');
  return sheet;
}

function headerIndexForHandover_(headers) {
  const map = {};
  headers.forEach(function(h, i) { map[String(h || '').trim().toLowerCase().replace(/\s+/g, '_')] = i; });
  [
    'manifest_id','manifest_number','manifest_date','shift','shift_name','drop_point_id','sprinter_id','sprinter_name',
    'seller_id','seller_name','receiver_name','receiver_phone','total_awb','status','pdf_file_id','pdf_url',
    'handover_at','completed_at','updated_at','updated_by'
  ].forEach(function(k) {
    if (map[k] === undefined) throw new Error('Kolom MANIFEST wajib: ' + k);
  });
  return map;
}

function headerIndexForHandoverTable_(headers) {
  const map = {};
  headers.forEach(function(h, i) { map[String(h || '').trim().toLowerCase().replace(/\s+/g, '_')] = i; });
  ['handover_id','manifest_id','seller_id','seller_name','receiver_name','handover_at','handover_by','status'].forEach(function(k) {
    if (map[k] === undefined) throw new Error('Kolom HANDOVER wajib: ' + k);
  });
  return map;
}

function sameValueForHandover_(a, b) {
  return String(a == null ? '' : a).trim().toLowerCase() === String(b == null ? '' : b).trim().toLowerCase();
}

function handoverDateValue_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value.toISOString();
  return String(value);
}

function writeHandoverAuditLog_(user, manifestId, manifestNumber, handoverId, timestamp) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AUDIT_LOG');
  if (!sheet) return;
  sheet.appendRow([
    timestamp,
    user.sprinter_id || '',
    user.nama_sprinter || '',
    user.role || '',
    'COMPLETE_HANDOVER',
    'HANDOVER',
    handoverId,
    JSON.stringify({ manifest_id: manifestId, manifest_number: manifestNumber, receiver_name: true, signature_embedded_to_pdf: true, photo_embedded_to_pdf: true })
  ]);
}
