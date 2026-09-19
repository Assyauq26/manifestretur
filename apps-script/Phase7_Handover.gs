/**
 * Manifest Retur - Phase 7: Hand Over & Evidence Capture
 *
 * This module is designed to be added to the existing Google Apps Script
 * backend. It does not replace the existing login/generateManifest logic.
 *
 * Required sheets:
 *   MANIFEST
 *
 * Expected MANIFEST columns (existing columns are preserved):
 *   manifest_id, manifest_number, manifest_date, shift, shift_name,
 *   drop_point_id/name, sprinter_id/name/phone, seller_id/name,
 *   receiver_name/phone, total_awb, status, pdf_file_id/url, timestamps
 *
 * Optional columns used by this module are created automatically when absent:
 *   handover_at, handover_by, handover_photo_url, handover_signature_url
 *
 * Existing authentication uses CacheService session tokens. The helper below
 * intentionally supports both token -> user and session_<token> -> user keys.
 */

const PHASE7_ROOT_FOLDER = 'MANIFEST_RETUR';
const PHASE7_EVIDENCE_FOLDER = 'HANDOVER';
const PHASE7_READY_STATUS = 'READY_HANDOVER';
const PHASE7_COMPLETED_STATUS = 'COMPLETED';

function phase7_getReadyHandover_(payload) {
  const user = phase7_requireUser_(payload && payload.userToken);
  const sheet = phase7_getSheet_('MANIFEST');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { success: true, data: [] };

  const headers = values[0].map(String);
  const idx = phase7_headerMap_(headers);
  const rows = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[idx.status] || '').trim().toUpperCase() !== PHASE7_READY_STATUS) continue;

    // Sprinters should only see manifests belonging to their operational scope.
    const sameSprinter = phase7_equal_(row[idx.sprinter_id], user.sprinter_id);
    const sameDropPoint = phase7_equal_(row[idx.drop_point_id], user.drop_point_id);
    if (user.role !== 'ADMIN' && !sameSprinter && !sameDropPoint) continue;

    rows.push({
      manifestNumber: phase7_cell_(row, idx.manifest_number),
      manifest_number: phase7_cell_(row, idx.manifest_number),
      manifestId: phase7_cell_(row, idx.manifest_id),
      sellerName: phase7_cell_(row, idx.seller_name),
      seller_name: phase7_cell_(row, idx.seller_name),
      totalAwb: Number(row[idx.total_awb] || 0),
      total_awb: Number(row[idx.total_awb] || 0),
      shift: phase7_cell_(row, idx.shift_name) || phase7_cell_(row, idx.shift),
      status: phase7_cell_(row, idx.status),
      manifestDate: phase7_isoDate_(row[idx.manifest_date])
    });
  }

  return { success: true, data: rows };
}

function phase7_completeHandover_(payload) {
  const user = phase7_requireUser_(payload && payload.userToken);
  const manifestNumber = String(payload && payload.manifestNumber || '').trim();
  if (!manifestNumber) throw new Error('Nomor manifest wajib diisi.');
  if (!payload.photoBase64) throw new Error('Foto bukti serah terima wajib diisi.');
  if (!payload.signatureBase64) throw new Error('Tanda tangan PIC Seller wajib diisi.');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const sheet = phase7_getSheet_('MANIFEST');
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) throw new Error('Manifest tidak ditemukan.');

    const headers = values[0].map(String);
    const idx = phase7_headerMap_(headers);
    phase7_ensureOptionalHeaders_(sheet, headers);

    // Re-read after optional headers were added.
    const latestValues = sheet.getDataRange().getValues();
    const latestHeaders = latestValues[0].map(String);
    const latestIdx = phase7_headerMap_(latestHeaders);

    let rowNumber = -1;
    let row = null;
    for (let r = 1; r < latestValues.length; r++) {
      if (String(latestValues[r][latestIdx.manifest_number] || '').trim() === manifestNumber) {
        rowNumber = r + 1;
        row = latestValues[r];
        break;
      }
    }
    if (rowNumber < 0) throw new Error('Manifest ' + manifestNumber + ' tidak ditemukan.');

    const currentStatus = String(row[latestIdx.status] || '').trim().toUpperCase();
    if (currentStatus !== PHASE7_READY_STATUS) {
      throw new Error('Manifest tidak dapat diserahkan. Status saat ini: ' + (currentStatus || 'KOSONG'));
    }

    const sameSprinter = phase7_equal_(row[latestIdx.sprinter_id], user.sprinter_id);
    const sameDropPoint = phase7_equal_(row[latestIdx.drop_point_id], user.drop_point_id);
    if (user.role !== 'ADMIN' && !sameSprinter && !sameDropPoint) {
      throw new Error('Anda tidak memiliki akses ke manifest ini.');
    }

    const now = new Date();
    const evidenceFolder = phase7_getEvidenceFolder_(now, manifestNumber);
    const photoFile = phase7_saveBase64File_(payload.photoBase64, evidenceFolder, manifestNumber + '_bukti');
    const signatureFile = phase7_saveBase64File_(payload.signatureBase64, evidenceFolder, manifestNumber + '_signature');

    sheet.getRange(rowNumber, latestIdx.status + 1).setValue(PHASE7_COMPLETED_STATUS);
    sheet.getRange(rowNumber, latestIdx.handover_at + 1).setValue(now);
    sheet.getRange(rowNumber, latestIdx.handover_by + 1).setValue(payload.handoverBy || user.nama_sprinter || user.sprinter_id || '');
    sheet.getRange(rowNumber, latestIdx.handover_photo_url + 1).setValue(photoFile.getUrl());
    sheet.getRange(rowNumber, latestIdx.handover_signature_url + 1).setValue(signatureFile.getUrl());

    return {
      success: true,
      message: 'Serah terima berhasil diselesaikan.',
      data: {
        manifestNumber: manifestNumber,
        status: PHASE7_COMPLETED_STATUS,
        handoverAt: now.toISOString(),
        photoUrl: photoFile.getUrl(),
        signatureUrl: signatureFile.getUrl()
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Add these two cases to the existing doPost action router:
 *
 * case 'getReadyHandover':
 *   return phase7_json_(phase7_getReadyHandover_(payload));
 * case 'completeHandover':
 *   return phase7_json_(phase7_completeHandover_(payload));
 *
 * Keep the project's existing doPost response wrapper if it already exists.
 */

function phase7_requireUser_(token) {
  if (!token) throw new Error('Sesi tidak ditemukan. Silakan login kembali.');

  const cache = CacheService.getScriptCache();
  let raw = cache.get(String(token));
  if (!raw) raw = cache.get('session_' + String(token));
  if (!raw) throw new Error('Sesi telah berakhir. Silakan login kembali.');

  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    throw new Error('Data sesi tidak valid. Silakan login kembali.');
  }
}

function phase7_getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet ' + name + ' tidak ditemukan.');
  return sheet;
}

function phase7_headerMap_(headers) {
  const normalized = {};
  headers.forEach(function(h, i) {
    const key = String(h || '').trim().toLowerCase().replace(/\s+/g, '_');
    normalized[key] = i;
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
    status: ['status']
  };

  Object.keys(aliases).forEach(function(canonical) {
    if (normalized[canonical] !== undefined) return;
    for (var i = 0; i < aliases[canonical].length; i++) {
      if (normalized[aliases[canonical][i]] !== undefined) {
        normalized[canonical] = normalized[aliases[canonical][i]];
        break;
      }
    }
  });

  ['manifest_number', 'status'].forEach(function(required) {
    if (normalized[required] === undefined) throw new Error('Kolom MANIFEST wajib: ' + required);
  });

  return normalized;
}

function phase7_ensureOptionalHeaders_(sheet, currentHeaders) {
  const required = ['handover_at', 'handover_by', 'handover_photo_url', 'handover_signature_url'];
  const existing = currentHeaders.map(function(h) { return String(h).trim().toLowerCase(); });
  const missing = required.filter(function(h) { return existing.indexOf(h) === -1; });
  if (!missing.length) return;

  const start = sheet.getLastColumn() + 1;
  sheet.getRange(1, start, 1, missing.length).setValues([missing]);
}

function phase7_getEvidenceFolder_(date, manifestNumber) {
  const root = phase7_getOrCreateFolder_(DriveApp.getFoldersByName(PHASE7_ROOT_FOLDER), PHASE7_ROOT_FOLDER, null);
  const handover = phase7_getOrCreateFolder_(root.getFoldersByName(PHASE7_EVIDENCE_FOLDER), PHASE7_EVIDENCE_FOLDER, root);
  const year = phase7_getOrCreateFolder_(handover.getFoldersByName(String(date.getFullYear())), String(date.getFullYear()), handover);
  const month = phase7_getOrCreateFolder_(year.getFoldersByName(('0' + (date.getMonth() + 1)).slice(-2)), ('0' + (date.getMonth() + 1)).slice(-2), year);
  const dayName = ('0' + date.getDate()).slice(-2);
  const day = phase7_getOrCreateFolder_(month.getFoldersByName(dayName), dayName, month);
  return phase7_getOrCreateFolder_(day.getFoldersByName(manifestNumber), manifestNumber, day);
}

function phase7_getOrCreateFolder_(iterator, name, parent) {
  if (iterator.hasNext()) return iterator.next();
  return parent ? parent.createFolder(name) : DriveApp.createFolder(name);
}

function phase7_saveBase64File_(dataUrl, folder, baseName) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Format evidence base64 tidak valid.');

  const mime = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const blob = Utilities.newBlob(bytes, mime, baseName + '.' + extension);
  return folder.createFile(blob);
}

function phase7_equal_(a, b) {
  return String(a == null ? '' : a).trim().toLowerCase() === String(b == null ? '' : b).trim().toLowerCase();
}

function phase7_cell_(row, index) {
  return index === undefined ? '' : String(row[index] == null ? '' : row[index]);
}

function phase7_isoDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value.toISOString();
  return String(value);
}

function phase7_json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
