/**
 * MANIFEST + HISTORY API
 * Read-only endpoints for the Manifest and Riwayat menus.
 */

function handleGetManifests_(requestData) {
  const user = getSessionUserForHandover_(requestData && requestData.userToken);
  const sheet = getRequiredSheetForHandover_('MANIFEST');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return createJsonResponse({ success: true, data: [] });

  const headers = values[0].map(String);
  const idx = headerIndexForHandover_(headers);
  const isAdmin = String(user.role || '').trim().toUpperCase() === 'ADMIN';
  const statusFilter = String(requestData.status || '').trim().toUpperCase();
  const query = String(requestData.query || '').trim().toLowerCase();
  const limit = Math.min(Math.max(Number(requestData.limit || 100), 1), 200);
  const offset = Math.max(Number(requestData.offset || 0), 0);
  const rows = [];

  for (let r = values.length - 1; r >= 1; r--) {
    const row = values[r];
    const status = String(row[idx.status] || '').trim().toUpperCase();
    if (statusFilter && status !== statusFilter) continue;

    const allowed = isAdmin ||
      sameValueForHandover_(row[idx.sprinter_id], user.sprinter_id) ||
      sameValueForHandover_(row[idx.drop_point_id], user.drop_point_id);
    if (!allowed) continue;

    const manifestNumber = String(row[idx.manifest_number] || '');
    const sellerName = String(row[idx.seller_name] || '');
    if (query && !(manifestNumber.toLowerCase().includes(query) || sellerName.toLowerCase().includes(query))) continue;

    rows.push({
      manifestId: String(row[idx.manifest_id] || ''),
      manifestNumber: manifestNumber,
      manifestDate: handoverDateValue_(row[idx.manifest_date]),
      shift: String(row[idx.shift_name] || row[idx.shift] || ''),
      dropPointId: String(row[idx.drop_point_id] || ''),
      sprinterName: String(row[idx.sprinter_name] || ''),
      sellerId: String(row[idx.seller_id] || ''),
      sellerName: sellerName,
      receiverName: String(row[idx.receiver_name] || ''),
      receiverPhone: String(row[idx.receiver_phone] || ''),
      totalAwb: Number(row[idx.total_awb] || 0),
      status: status,
      pdfUrl: String(row[idx.pdf_url] || ''),
      createdAt: handoverDateValue_(row[idx.created_at]),
      handoverAt: handoverDateValue_(row[idx.handover_at]),
      completedAt: handoverDateValue_(row[idx.completed_at])
    });
  }

  return createJsonResponse({
    success: true,
    data: rows.slice(offset, offset + limit),
    meta: { total: rows.length, offset: offset, limit: limit }
  });
}

function handleGetHistory_(requestData) {
  const user = getSessionUserForHandover_(requestData && requestData.userToken);
  const sheet = getRequiredSheetForHandover_('MANIFEST');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return createJsonResponse({ success: true, data: [] });

  const headers = values[0].map(String);
  const idx = headerIndexForHandover_(headers);
  const isAdmin = String(user.role || '').trim().toUpperCase() === 'ADMIN';
  const query = String(requestData.query || '').trim().toLowerCase();
  const statusFilter = String(requestData.status || '').trim().toUpperCase();
  const limit = Math.min(Math.max(Number(requestData.limit || 100), 1), 200);
  const offset = Math.max(Number(requestData.offset || 0), 0);
  const result = [];

  for (let r = values.length - 1; r >= 1; r--) {
    const row = values[r];
    const status = String(row[idx.status] || '').trim().toUpperCase();
    if (statusFilter && status !== statusFilter) continue;

    const allowed = isAdmin ||
      sameValueForHandover_(row[idx.sprinter_id], user.sprinter_id) ||
      sameValueForHandover_(row[idx.drop_point_id], user.drop_point_id);
    if (!allowed) continue;

    const manifestNumber = String(row[idx.manifest_number] || '');
    const sellerName = String(row[idx.seller_name] || '');
    if (query && !(manifestNumber.toLowerCase().includes(query) || sellerName.toLowerCase().includes(query))) continue;

    result.push({
      manifestId: String(row[idx.manifest_id] || ''),
      manifestNumber: manifestNumber,
      manifestDate: handoverDateValue_(row[idx.manifest_date]),
      sellerName: sellerName,
      receiverName: String(row[idx.receiver_name] || ''),
      totalAwb: Number(row[idx.total_awb] || 0),
      status: status,
      pdfUrl: String(row[idx.pdf_url] || ''),
      createdAt: handoverDateValue_(row[idx.created_at]),
      handoverAt: handoverDateValue_(row[idx.handover_at]),
      completedAt: handoverDateValue_(row[idx.completed_at]),
      sprinterName: String(row[idx.sprinter_name] || ''),
      dropPointId: String(row[idx.drop_point_id] || '')
    });
  }

  return createJsonResponse({
    success: true,
    data: result.slice(offset, offset + limit),
    meta: { total: result.length, offset: offset, limit: limit }
  });
}
