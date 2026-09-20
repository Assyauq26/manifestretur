/**
 * PHASE 7: HANDOVER
 * Canonical PHOTO-ONLY implementation.
 *
 * Flow:
 * 1. Manifest must be READY_HANDOVER.
 * 2. User submits one compressed photo as base64.
 * 3. Photo is embedded into the existing manifest PDF as the final page.
 * 4. The old PDF is replaced by the updated PDF.
 * 5. No handover photo or signature file is stored in Drive.
 * 6. HANDOVER remains the transaction/audit table; legacy signature columns
 *    are kept blank for backward compatibility with the existing schema.
 */

const HANDOVER_READY_STATUS = 'READY_HANDOVER';
const HANDOVER_COMPLETED_STATUS = 'COMPLETED';

function handleGetReadyHandoverV2(requestData) {
  try {
    const user = getSessionUserForHandover_(requestData && requestData.userToken);
    const sheet = getRequiredSheetForHandover_('MANIFEST');
    const values = sheet.getDataRange().getValues();

    if (values.length < 2) {
      return createJsonResponse({ success: true, data: [] });
    }

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

    if (!manifestNumber) {
      return createErrorResponse('Nomor manifest wajib diisi.');
    }

    if (!photoBase64) {
      return createErrorResponse('Foto bukti serah terima wajib diisi.');
    }

    validateHandoverPhotoDataUrl_(photoBase64);

    lock = LockService.getScriptLock();
    lock.waitLock(15000);

    const manifestSheet = getRequiredSheetForHandover_('MANIFEST');
    const handoverSheet = getRequiredSheetForHandover_('HANDOVER');
    const manifestValues = manifestSheet.getDataRange().getValues();

    if (manifestValues.length < 2) {
      return createErrorResponse('Manifest tidak ditemukan.');
    }

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

    if (rowNumber < 0) {
      return createErrorResponse('Manifest ' + manifestNumber + ' tidak ditemukan.');
    }

    const status = String(manifestRow[idx.status] || '').trim().toUpperCase();
    if (status !== HANDOVER_READY_STATUS) {
      return createErrorResponse(
        'Manifest tidak dapat diserahkan. Status saat ini: ' + (status || 'KOSONG')
      );
    }

    const isAdmin = String(user.role || '').trim().toUpperCase() === 'ADMIN';
    const allowed = isAdmin ||
      sameValueForHandover_(manifestRow[idx.sprinter_id], user.sprinter_id) ||
      sameValueForHandover_(manifestRow[idx.drop_point_id], user.drop_point_id);

    if (!allowed) {
      return createErrorResponse('Anda tidak memiliki akses ke manifest ini.', 403);
    }

    const manifestId = String(manifestRow[idx.manifest_id] || '').trim();
    const sellerId = String(manifestRow[idx.seller_id] || '').trim();
    const sellerName = String(manifestRow[idx.seller_name] || '').trim();
    const sellerPhone = String(manifestRow[idx.receiver_phone] || '').trim();
    const oldPdfFileId = String(manifestRow[idx.pdf_file_id] || '').trim();
    const oldPdfUrl = String(manifestRow[idx.pdf_url] || '').trim();
    const now = new Date();

    if (!manifestId) {
      return createErrorResponse('Manifest ID kosong. Data manifest tidak valid.', 500);
    }

    const awbs = getManifestAwbsForHandover_(manifestId);
    if (awbs.length === 0) {
      return createErrorResponse('AWB manifest tidak ditemukan. PDF tidak dapat diperbarui.', 500);
    }

    // Rebuild the same manifest form and append the evidence photo as its last page.
    // The photo is never written to Drive as a separate file.
    const pdfUser = {
      drop_point_id: String(manifestRow[idx.drop_point_id] || user.drop_point_id || ''),
      nama_sprinter: String(manifestRow[idx.sprinter_name] || user.nama_sprinter || ''),
      no_hp: String(manifestRow[idx.sprinter_phone] || user.no_hp || '')
    };

    const pdfResult = generatePdfDrive(
      manifestNumber,
      pdfUser,
      sellerName,
      String(manifestRow[idx.receiver_name] || '-'),
      sellerPhone || '-',
      awbs,
      photoBase64,
      oldPdfFileId,
      manifestRow[idx.manifest_date]
    );

    const handoverHeaders = handoverSheet.getDataRange().getValues()[0].map(String);
    const hidx = headerIndexForHandoverTable_(handoverHeaders);
    const handoverId = Utilities.getUuid();
    const handoverBy = String(
      requestData.handoverBy || user.nama_sprinter || user.sprinter_id || ''
    ).trim();

    const handoverRow = new Array(handoverHeaders.length).fill('');
    handoverRow[hidx.handover_id] = handoverId;
    handoverRow[hidx.manifest_id] = manifestId;
    handoverRow[hidx.seller_id] = sellerId;
    handoverRow[hidx.seller_name] = sellerName;
    handoverRow[hidx.handover_at] = now;
    handoverRow[hidx.handover_by] = handoverBy;
    // PHOTO-ONLY: no photo file is stored in Drive.
    handoverRow[hidx.photo_file_id] = '';
    handoverRow[hidx.photo_url] = '';
    // Legacy signature columns remain blank after the TTD feature was removed.
    handoverRow[hidx.signature_file_id] = '';
    handoverRow[hidx.signature_url] = '';
    handoverRow[hidx.notes] = String(requestData.notes || 'PHOTO_ONLY | FOTO_EMBEDDED_TO_MANIFEST_PDF');
    handoverRow[hidx.status] = HANDOVER_COMPLETED_STATUS;
    handoverSheet.appendRow(handoverRow);

    manifestSheet.getRange(rowNumber, idx.status + 1).setValue(HANDOVER_COMPLETED_STATUS);
    manifestSheet.getRange(rowNumber, idx.handover_at + 1).setValue(now);
    manifestSheet.getRange(rowNumber, idx.completed_at + 1).setValue(now);
    manifestSheet.getRange(rowNumber, idx.pdf_file_id + 1).setValue(pdfResult.id);
    manifestSheet.getRange(rowNumber, idx.pdf_url + 1).setValue(pdfResult.url);
    manifestSheet.getRange(rowNumber, idx.updated_at + 1).setValue(now);
    manifestSheet.getRange(rowNumber, idx.updated_by + 1).setValue(user.sprinter_id || handoverBy);

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
        photoUrl: '',
        photoStoredInDrive: false,
        signatureUrl: '',
        pdfUpdated: true,
        pdfUrl: pdfResult.url,
        previousPdfUrl: oldPdfUrl
      }
    });
  } catch (error) {
    return createErrorResponse(
      error.message || 'Gagal menyelesaikan serah terima.',
      500
    );
  } finally {
    if (lock) lock.releaseLock();
  }
}

function getManifestAwbsForHandover_(manifestId) {
  const sheet = getRequiredSheetForHandover_('MANIFEST_AWB');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(String);
  const idx = {};
  headers.forEach(function(header, i) {
    idx[String(header || '').trim().toLowerCase().replace(/\s+/g, '_')] = i;
  });

  ['manifest_id', 'awb', 'sequence'].forEach(function(key) {
    if (idx[key] === undefined) {
      throw new Error('Kolom MANIFEST_AWB wajib: ' + key);
    }
  });

  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[idx.manifest_id] || '').trim() !== manifestId) continue;

    const awb = String(row[idx.awb] || '').trim();
    if (!awb) continue;

    rows.push({
      awb: awb,
      sequence: Number(row[idx.sequence] || 0)
    });
  }

  rows.sort(function(a, b) {
    return a.sequence - b.sequence;
  });

  return rows.map(function(item) { return item.awb; });
}

function validateHandoverPhotoDataUrl_(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) {
    throw new Error('Format foto tidak valid. Gunakan JPG, PNG, atau WEBP.');
  }

  const bytes = Utilities.base64Decode(match[2]);
  if (!bytes || bytes.length === 0) {
    throw new Error('Foto bukti serah terima kosong.');
  }

  // Keep the request intentionally bounded so a very large camera image does
  // not turn a handover request into an oversized Apps Script execution.
  if (bytes.length > 3 * 1024 * 1024) {
    throw new Error('Ukuran foto terlalu besar. Gunakan foto yang sudah dikompresi.');
  }
}

function getSessionUserForHandover_(token) {
  if (!token) throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
  const raw = CacheService.getScriptCache().get(String(token));
  if (!raw) throw new Error('Sesi telah berakhir. Silakan login kembali.');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error('Data sesi tidak valid. Silakan login kembali.');
  }
}

function getRequiredSheetForHandover_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Sheet ' + name + ' tidak ditemukan.');
  return sheet;
}

function headerIndexForHandover_(headers) {
  const map = {};
  headers.forEach(function(h, i) {
    map[String(h || '').trim().toLowerCase().replace(/\s+/g, '_')] = i;
  });

  [
    'manifest_id', 'manifest_number', 'manifest_date', 'shift', 'shift_name',
    'drop_point_id', 'sprinter_id', 'sprinter_name', 'sprinter_phone',
    'seller_id', 'seller_name', 'receiver_name', 'receiver_phone', 'total_awb',
    'status', 'pdf_file_id', 'pdf_url', 'handover_at', 'completed_at',
    'updated_at', 'updated_by'
  ].forEach(function(k) {
    if (map[k] === undefined) throw new Error('Kolom MANIFEST wajib: ' + k);
  });

  return map;
}

function headerIndexForHandoverTable_(headers) {
  const map = {};
  headers.forEach(function(h, i) {
    map[String(h || '').trim().toLowerCase().replace(/\s+/g, '_')] = i;
  });

  [
    'handover_id', 'manifest_id', 'seller_id', 'seller_name', 'handover_at',
    'handover_by', 'photo_file_id', 'photo_url', 'signature_file_id',
    'signature_url', 'notes', 'status'
  ].forEach(function(k) {
    if (map[k] === undefined) throw new Error('Kolom HANDOVER wajib: ' + k);
  });

  return map;
}

function sameValueForHandover_(a, b) {
  return String(a == null ? '' : a).trim().toLowerCase() ===
    String(b == null ? '' : b).trim().toLowerCase();
}

function handoverDateValue_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value.toISOString();
  }
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
    JSON.stringify({
      manifest_id: manifestId,
      manifest_number: manifestNumber,
      mode: 'PHOTO_ONLY',
      photo_embedded_to_pdf: true,
      photo_stored_in_drive: false
    })
  ]);
}
