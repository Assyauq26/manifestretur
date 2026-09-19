/**
 * PHASE 7: HANDOVER
 * Canonical implementation based on SchemaSetup.gs + Auth.gs.
 * Uses HANDOVER as the evidence/transaction table.
 *
 * Router integration in Kode.gs:
 *   case 'getReadyHandover': return handleGetReadyHandoverV2(requestData);
 *   case 'completeHandover': return handleCompleteHandoverV2(requestData);
 */

const HANDOVER_READY_STATUS = 'READY_HANDOVER';
const HANDOVER_COMPLETED_STATUS = 'COMPLETED';
const HANDOVER_ROOT_FOLDER = 'MANIFEST_RETUR';
const HANDOVER_FOLDER = 'HANDOVER';

function handleGetReadyHandoverV2(requestData) {
  try {
    const user = getSessionUserForHandover_(requestData && requestData.userToken);
    const sheet = getRequiredSheetForHandover_('MANIFEST');
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return createJsonResponse({ success: true, data: [] });

    const headers = values[0].map(String);
    const idx = headerIndexForHandover_(headers);
    const isAdmin = String(user.role || '').toUpperCase() === 'ADMIN';
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
    if (!manifestNumber) return createErrorResponse('Nomor manifest wajib diisi.');
    if (!requestData.photoBase64) return createErrorResponse('Foto bukti serah terima wajib diisi.');
    if (!requestData.signatureBase64) return createErrorResponse('Tanda tangan PIC Seller wajib diisi.');

    lock = LockService.getScriptLock();
    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
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

    const isAdmin = String(user.role || '').toUpperCase() === 'ADMIN';
    const allowed = isAdmin ||
      sameValueForHandover_(manifestRow[idx.sprinter_id], user.sprinter_id) ||
      sameValueForHandover_(manifestRow[idx.drop_point_id], user.drop_point_id);
    if (!allowed) return createErrorResponse('Anda tidak memiliki akses ke manifest ini.', 403);

    const now = new Date();
    const manifestId = String(manifestRow[idx.manifest_id] || '');
    const sellerId = String(manifestRow[idx.seller_id] || '');
    const sellerName = String(manifestRow[idx.seller_name] || '');
    const folder = getHandoverEvidenceFolderV2_(now, manifestNumber);
    const photoFile = saveHandoverEvidenceV2_(requestData.photoBase64, folder, manifestNumber + '_bukti');
    const signatureFile = saveHandoverEvidenceV2_(requestData.signatureBase64, folder, manifestNumber + '_signature');

    const handoverHeaders = handoverSheet.getDataRange().getValues()[0].map(String);
    const hidx = headerIndexForHandoverTable_(handoverHeaders);
    const handoverId = Utilities.getUuid();
    const handoverBy = String(requestData.handoverBy || user.nama_sprinter || user.sprinter_id || '');

    const handoverRow = new Array(handoverHeaders.length).fill('');
    handoverRow[hidx.handover_id] = handoverId;
    handoverRow[hidx.manifest_id] = manifestId;
    handoverRow[hidx.seller_id] = sellerId;
    handoverRow[hidx.seller_name] = sellerName;
    handoverRow[hidx.handover_at] = now;
    handoverRow[hidx.handover_by] = handoverBy;
    handoverRow[hidx.photo_file_id] = photoFile.getId();
    handoverRow[hidx.photo_url] = photoFile.getUrl();
    handoverRow[hidx.signature_file_id] = signatureFile.getId();
    handoverRow[hidx.signature_url] = signatureFile.getUrl();
    handoverRow[hidx.notes] = String(requestData.notes || '');
    handoverRow[hidx.status] = HANDOVER_COMPLETED_STATUS;
    handoverSheet.appendRow(handoverRow);

    manifestSheet.getRange(rowNumber, idx.status + 1).setValue(HANDOVER_COMPLETED_STATUS);
    manifestSheet.getRange(rowNumber, idx.handover_at + 1).setValue(now);
    manifestSheet.getRange(rowNumber, idx.completed_at + 1).setValue(now);

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
        photoUrl: photoFile.getUrl(),
        signatureUrl: signatureFile.getUrl()
      }
    });
  } catch (error) {
    return createErrorResponse(error.message || 'Gagal menyelesaikan serah terima.', 500);
  } finally {
    if (lock) lock.releaseLock();
  }
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
  ['manifest_id','manifest_number','manifest_date','shift','shift_name','drop_point_id','sprinter_id','sprinter_name','seller_id','seller_name','receiver_name','total_awb','status','pdf_url','handover_at','completed_at'].forEach(function(k) {
    if (map[k] === undefined) throw new Error('Kolom MANIFEST wajib: ' + k);
  });
  return map;
}

function headerIndexForHandoverTable_(headers) {
  const map = {};
  headers.forEach(function(h, i) { map[String(h || '').trim().toLowerCase().replace(/\s+/g, '_')] = i; });
  ['handover_id','manifest_id','seller_id','seller_name','handover_at','handover_by','photo_file_id','photo_url','signature_file_id','signature_url','notes','status'].forEach(function(k) {
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

function getHandoverEvidenceFolderV2_(date, manifestNumber) {
  const root = getOrCreateHandoverFolderV2_(DriveApp.getFoldersByName(HANDOVER_ROOT_FOLDER), HANDOVER_ROOT_FOLDER, null);
  const handover = getOrCreateHandoverFolderV2_(root.getFoldersByName(HANDOVER_FOLDER), HANDOVER_FOLDER, root);
  const yearName = Utilities.formatDate(date, 'Asia/Jakarta', 'yyyy');
  const monthName = Utilities.formatDate(date, 'Asia/Jakarta', 'MM');
  const dayName = Utilities.formatDate(date, 'Asia/Jakarta', 'dd');
  const year = getOrCreateHandoverFolderV2_(handover.getFoldersByName(yearName), yearName, handover);
  const month = getOrCreateHandoverFolderV2_(year.getFoldersByName(monthName), monthName, year);
  const day = getOrCreateHandoverFolderV2_(month.getFoldersByName(dayName), dayName, month);
  return getOrCreateHandoverFolderV2_(day.getFoldersByName(manifestNumber), manifestNumber, day);
}

function getOrCreateHandoverFolderV2_(iterator, name, parent) {
  if (iterator.hasNext()) return iterator.next();
  return parent ? parent.createFolder(name) : DriveApp.createFolder(name);
}

function saveHandoverEvidenceV2_(dataUrl, folder, baseName) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Format evidence base64 tidak valid.');
  const mime = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  let extension = 'jpg';
  if (mime === 'image/png') extension = 'png';
  else if (mime === 'image/webp') extension = 'webp';
  const blob = Utilities.newBlob(bytes, mime, baseName + '.' + extension);
  return folder.createFile(blob);
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
    JSON.stringify({ manifest_id: manifestId, manifest_number: manifestNumber })
  ]);
}
