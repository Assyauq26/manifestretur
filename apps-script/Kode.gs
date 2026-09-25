/**
 * MANIFEST RETUR - GOOGLE APPS SCRIPT BACKEND
 * Phase 1-7 API routing.
 */

const PHASE7_READY_STATUS = 'READY_HANDOVER';
const PHASE7_COMPLETED_STATUS = 'COMPLETED';

function doOptions(e) { return createJsonResponse({ success: true, message: 'CORS OK' }); }

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return createErrorResponse('Request body tidak ditemukan.', 400);
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    switch (action) {
      case 'ping': return createJsonResponse({ success: true, message: 'API is online' });
      case 'login': return handleLogin(requestData);
      case 'getSellers': return handleGetSellers();
      case 'generateManifest': return handleGenerateManifest(requestData);
      case 'getManifests': return handleGetManifests_(requestData);
      case 'getHistory': return handleGetHistory_(requestData);
      case 'getReadyHandover': return handleGetReadyHandoverV2(requestData);
      case 'completeHandover': return handleCompleteHandoverV2(requestData);
      default: return createErrorResponse('Action tidak dikenal: ' + action, 400);
    }
  } catch (error) {
    return createErrorResponse('Server error: ' + error.message, 500);
  }
}

function doGet(e) { return createJsonResponse({ success: true, message: 'API Running' }); }

function handleGetSellers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SELLER_MASTER');
  if (!sheet) return createErrorResponse('Sheet SELLER_MASTER tidak ditemukan.', 500);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return createJsonResponse({ success: true, data: [] });
  const headers = data[0];
  const sellerIdIdx = headers.indexOf('seller_id');
  const sellerNameIdx = headers.indexOf('seller_name');
  const receiverNameIdx = headers.indexOf('receiver_name');
  const phoneIdx = headers.indexOf('phone');
  const statusIdx = headers.indexOf('status');
  const sellers = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][statusIdx] || '').trim().toUpperCase() !== 'ACTIVE') continue;
    sellers.push({ seller_id: data[i][sellerIdIdx], seller_name: data[i][sellerNameIdx], receiver_name: data[i][receiverNameIdx], phone: data[i][phoneIdx] });
  }
  return createJsonResponse({ success: true, data: sellers });
}

function handleGenerateManifest(requestData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const manifestSheet = ss.getSheetByName('MANIFEST');
  const awbSheet = ss.getSheetByName('MANIFEST_AWB');
  const sellerSheet = ss.getSheetByName('SELLER_MASTER');
  if (!manifestSheet || !awbSheet || !sellerSheet) return createErrorResponse('Tabel database belum lengkap.', 500);

  const shift = requestData.shift;
  const sellerId = requestData.sellerId;
  const awbs = requestData.awbs;
  const userToken = requestData.userToken;
  if (!Array.isArray(awbs) || awbs.length === 0) return createErrorResponse('Daftar AWB tidak boleh kosong.');

  const cachedUser = CacheService.getScriptCache().get(String(userToken || ''));
  if (!cachedUser) return createErrorResponse('Session expired. Silakan login kembali.', 401);
  let user;
  try { user = JSON.parse(cachedUser); } catch (error) { return createErrorResponse('Data session tidak valid.', 401); }

  const sellerData = sellerSheet.getDataRange().getValues();
  const sellerHeaders = sellerData[0];
  const sellerIdIdx = sellerHeaders.indexOf('seller_id');
  const sellerNameIdx = sellerHeaders.indexOf('seller_name');
  const receiverNameIdx = sellerHeaders.indexOf('receiver_name');
  const sellerPhoneIdx = sellerHeaders.indexOf('phone');
  const sellerStatusIdx = sellerHeaders.indexOf('status');
  let sellerInfo = null;
  for (let i = 1; i < sellerData.length; i++) {
    if (String(sellerData[i][sellerIdIdx] || '') === String(sellerId || '') && String(sellerData[i][sellerStatusIdx] || '').trim().toUpperCase() === 'ACTIVE') { sellerInfo = sellerData[i]; break; }
  }
  if (!sellerInfo) return createErrorResponse('Seller tidak ditemukan atau tidak aktif.');

  const sellerName = sellerInfo[sellerNameIdx] || '';
  const receiverName = sellerInfo[receiverNameIdx] || '-';
  const sellerPhone = sellerInfo[sellerPhoneIdx] || '-';
  const today = new Date();
  const dateString = Utilities.formatDate(today, 'Asia/Jakarta', 'yyyyMMdd');
  const prefix = 'MR-' + dateString + '-' + user.drop_point_id + '-';
  let maxSeq = 0;
  const manifestData = manifestSheet.getDataRange().getValues();
  if (manifestData.length > 1) {
    const manifestHeaders = manifestData[0];
    const manifestNumberIdx = manifestHeaders.indexOf('manifest_number');
    for (let i = manifestData.length - 1; i > 0; i--) {
      const number = manifestData[i][manifestNumberIdx];
      if (number && String(number).startsWith(prefix)) {
        const parts = String(number).split('-'); const sequence = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(sequence) && sequence > maxSeq) maxSeq = sequence;
      }
    }
  }
  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  const manifestNumber = prefix + nextSeq;
  const manifestId = Utilities.getUuid();
  const shiftName = shift === '1' ? 'Pagi' : shift === '2' ? 'Siang' : 'Sore';
  const totalAwb = awbs.length;
  const pdfResult = generatePdfDrive(manifestNumber, user, sellerName, receiverName, sellerPhone, awbs);

  manifestSheet.appendRow([manifestId, manifestNumber, today, shift, shiftName, user.drop_point_id, 'Nama DP Temp', user.sprinter_id, user.nama_sprinter, user.no_hp, sellerId, sellerName, receiverName, sellerPhone, totalAwb, 'READY_HANDOVER', pdfResult.id, pdfResult.url, today, user.sprinter_id, today, user.sprinter_id, today, '', '']);
  const awbRows = awbs.map(function(awb, index) { return [Utilities.getUuid(), manifestId, String(awb).trim(), index + 1, 'UNKNOWN', today, user.sprinter_id, 'ACTIVE']; });
  if (awbRows.length > 0) awbSheet.getRange(awbSheet.getLastRow() + 1, 1, awbRows.length, awbRows[0].length).setValues(awbRows);
  return createJsonResponse({ success: true, message: 'Manifest berhasil dibuat.', data: { manifestId: manifestId, manifestNumber: manifestNumber, pdfUrl: pdfResult.url, status: 'READY_HANDOVER' } });
}

function getOrCreateFolder(path) {
  const parts = String(path).split('/'); let currentFolder = DriveApp.getRootFolder();
  for (let i = 0; i < parts.length; i++) { if (!parts[i]) continue; const folders = currentFolder.getFoldersByName(parts[i]); currentFolder = folders.hasNext() ? folders.next() : currentFolder.createFolder(parts[i]); }
  return currentFolder;
}

function escapePdfHtml_(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;'); }
