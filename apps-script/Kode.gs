/**
 * MANIFEST RETUR - GOOGLE APPS SCRIPT BACKEND
 *
 * Phase 1-6: database/API, seller, manifest, AWB and PDF.
 * Phase 7: routing is delegated to Handover.gs (V2 canonical implementation).
 * Authentication is delegated to Auth.gs.
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
        return handleGetSellers();
      case 'generateManifest':
        return handleGenerateManifest(requestData);
      case 'getReadyHandover':
        return handleGetReadyHandoverV2(requestData);
      case 'completeHandover':
        return handleCompleteHandoverV2(requestData);
      default:
        return createErrorResponse(
          'Action tidak dikenal: ' + action,
          400
        );
    }
  } catch (error) {
    return createErrorResponse(
      'Server error: ' + error.message,
      500
    );
  }
}

function doGet(e) {
  return createJsonResponse({
    success: true,
    message: 'API Running'
  });
}

function handleGetSellers() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName('SELLER_MASTER');

  if (!sheet) {
    return createErrorResponse(
      'Sheet SELLER_MASTER tidak ditemukan.',
      500
    );
  }

  const data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    return createJsonResponse({
      success: true,
      data: []
    });
  }

  const headers = data[0];
  const sellerIdIdx = headers.indexOf('seller_id');
  const sellerNameIdx = headers.indexOf('seller_name');
  const receiverNameIdx = headers.indexOf('receiver_name');
  const phoneIdx = headers.indexOf('phone');
  const statusIdx = headers.indexOf('status');

  const sellers = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    if (
      String(row[statusIdx] || '')
        .trim()
        .toUpperCase() !== 'ACTIVE'
    ) {
      continue;
    }

    sellers.push({
      seller_id: row[sellerIdIdx],
      seller_name: row[sellerNameIdx],
      receiver_name: row[receiverNameIdx],
      phone: row[phoneIdx]
    });
  }

  return createJsonResponse({
    success: true,
    data: sellers
  });
}

function handleGenerateManifest(requestData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const manifestSheet = ss.getSheetByName('MANIFEST');
  const awbSheet = ss.getSheetByName('MANIFEST_AWB');
  const sellerSheet = ss.getSheetByName('SELLER_MASTER');

  if (!manifestSheet || !awbSheet || !sellerSheet) {
    return createErrorResponse(
      'Tabel database belum lengkap.',
      500
    );
  }

  const shift = requestData.shift;
  const sellerId = requestData.sellerId;
  const awbs = requestData.awbs;
  const userToken = requestData.userToken;

  if (!Array.isArray(awbs) || awbs.length === 0) {
    return createErrorResponse(
      'Daftar AWB tidak boleh kosong.'
    );
  }

  const cachedUser = CacheService
    .getScriptCache()
    .get(String(userToken || ''));

  if (!cachedUser) {
    return createErrorResponse(
      'Session expired. Silakan login kembali.',
      401
    );
  }

  let user;

  try {
    user = JSON.parse(cachedUser);
  } catch (error) {
    return createErrorResponse(
      'Data session tidak valid.',
      401
    );
  }

  const sellerData = sellerSheet.getDataRange().getValues();
  const sellerHeaders = sellerData[0];

  const sellerIdIdx = sellerHeaders.indexOf('seller_id');
  const sellerNameIdx = sellerHeaders.indexOf('seller_name');
  const receiverNameIdx = sellerHeaders.indexOf('receiver_name');
  const sellerPhoneIdx = sellerHeaders.indexOf('phone');
  const sellerStatusIdx = sellerHeaders.indexOf('status');

  let sellerInfo = null;

  for (let i = 1; i < sellerData.length; i++) {
    if (
      String(sellerData[i][sellerIdIdx] || '') === String(sellerId || '') &&
      String(sellerData[i][sellerStatusIdx] || '')
        .trim()
        .toUpperCase() === 'ACTIVE'
    ) {
      sellerInfo = sellerData[i];
      break;
    }
  }

  if (!sellerInfo) {
    return createErrorResponse(
      'Seller tidak ditemukan atau tidak aktif.'
    );
  }

  const sellerName = sellerInfo[sellerNameIdx] || '';
  const receiverName = sellerInfo[receiverNameIdx] || '-';
  const sellerPhone = sellerInfo[sellerPhoneIdx] || '-';

  const today = new Date();

  const dateString = Utilities.formatDate(
    today,
    'Asia/Jakarta',
    'yyyyMMdd'
  );

  const prefix =
    'MR-' + dateString + '-' + user.drop_point_id + '-';

  let maxSeq = 0;
  const manifestData = manifestSheet.getDataRange().getValues();

  if (manifestData.length > 1) {
    const manifestHeaders = manifestData[0];
    const manifestNumberIdx =
      manifestHeaders.indexOf('manifest_number');

    for (let i = manifestData.length - 1; i > 0; i--) {
      const number = manifestData[i][manifestNumberIdx];

      if (
        number &&
        String(number).startsWith(prefix)
      ) {
        const parts = String(number).split('-');
        const sequence = parseInt(
          parts[parts.length - 1],
          10
        );

        if (!isNaN(sequence) && sequence > maxSeq) {
          maxSeq = sequence;
        }
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  const manifestNumber = prefix + nextSeq;
  const manifestId = Utilities.getUuid();

  const shiftName =
    shift === '1'
      ? 'Pagi'
      : shift === '2'
        ? 'Siang'
        : 'Sore';

  const totalAwb = awbs.length;

  const pdfResult = generatePdfDrive(
    manifestNumber,
    user,
    sellerName,
    receiverName,
    sellerPhone,
    awbs
  );

  manifestSheet.appendRow([
    manifestId,
    manifestNumber,
    today,
    shift,
    shiftName,
    user.drop_point_id,
    'Nama DP Temp',
    user.sprinter_id,
    user.nama_sprinter,
    user.no_hp,
    sellerId,
    sellerName,
    receiverName,
    sellerPhone,
    totalAwb,
    'READY_HANDOVER',
    pdfResult.id,
    pdfResult.url,
    today,
    user.sprinter_id,
    today,
    user.sprinter_id,
    today,
    '',
    ''
  ]);

  const awbRows = awbs.map(function(awb, index) {
    return [
      Utilities.getUuid(),
      manifestId,
      String(awb).trim(),
      index + 1,
      'UNKNOWN',
      today,
      user.sprinter_id,
      'ACTIVE'
    ];
  });

  if (awbRows.length > 0) {
    const startRow = awbSheet.getLastRow() + 1;

    awbSheet
      .getRange(
        startRow,
        1,
        awbRows.length,
        awbRows[0].length
      )
      .setValues(awbRows);
  }

  return createJsonResponse({
    success: true,
    message: 'Manifest berhasil dibuat.',
    data: {
      manifestId: manifestId,
      manifestNumber: manifestNumber,
      pdfUrl: pdfResult.url,
      status: 'READY_HANDOVER'
    }
  });
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

/**
 * Generate the Manifest Retur PDF using the physical form supplied
 * by the user as the visual reference.
 *
 * Layout:
 * - A4 portrait
 * - 40 numbered rows
 * - 5 AWB columns per row (up to 200 AWB)
 * - Drop Point and Seller information blocks
 * - Total returned AWB line
 * - Footer statement and two signature blocks
 */
function generatePdfDrive(
  manifestNumber,
  user,
  sellerName,
  receiverName,
  sellerPhone,
  awbs
) {
  const now = new Date();

  const dateStr = Utilities.formatDate(
    now,
    'Asia/Jakarta',
    'dd/MM/yyyy'
  );

  const safeDropPoint = escapePdfHtml_(user.drop_point_id || '');
  const safeSprinter = escapePdfHtml_(user.nama_sprinter || '');
  const safeSprinterPhone = escapePdfHtml_(user.no_hp || '');
  const safeSeller = escapePdfHtml_(sellerName || '');
  const safeReceiver = escapePdfHtml_(receiverName || '');
  const safeSellerPhone = escapePdfHtml_(sellerPhone || '');

  const totalRows = 40;
  const awbColumns = 5;
  let awbGridRows = '';

  for (let row = 0; row < totalRows; row++) {
    awbGridRows += '<tr>';
    awbGridRows += '<td class="row-no">' + (row + 1) + '</td>';

    for (let col = 0; col < awbColumns; col++) {
      const index = (row * awbColumns) + col;
      const value = index < awbs.length ? escapePdfHtml_(awbs[index]) : '';
      awbGridRows += '<td class="awb-cell">' + value + '</td>';
    }

    awbGridRows += '</tr>';
  }

  const totalAwb = awbs.length;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: A4 portrait;
    margin: 5mm 4.5mm 4.5mm 4.5mm;
  }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #111111;
    font-family: Arial, "Noto Sans", sans-serif;
    font-size: 8pt;
    line-height: 1.05;
  }

  .page { width: 100%; }

  .top {
    position: relative;
    height: 17mm;
  }

  .system {
    position: absolute;
    top: 0;
    left: 0;
    font-size: 7.2pt;
    font-weight: 700;
    white-space: nowrap;
  }

  .logo {
    position: absolute;
    top: -1mm;
    right: 7mm;
    color: #D71920;
    font-size: 15pt;
    font-weight: 900;
    font-style: italic;
    white-space: nowrap;
  }

  .logo small {
    font-size: 8pt;
    margin-left: 1mm;
  }

  .date {
    position: absolute;
    left: 0;
    bottom: 0;
    font-size: 7.8pt;
    font-weight: 700;
  }

  .title {
    text-align: center;
    font-size: 10.5pt;
    font-weight: 800;
    margin-top: 0.5mm;
  }

  .subtitle {
    text-align: center;
    font-size: 8pt;
    margin-top: 0.8mm;
    margin-bottom: 2.2mm;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .info-table { margin-bottom: 2mm; }

  .info-table td {
    border: 0.35pt solid #777777;
    padding: 0.65mm 0.8mm;
    height: 4.6mm;
    vertical-align: middle;
    white-space: nowrap;
    overflow: hidden;
  }

  .info-table .section {
    background: #B4C7E7;
    font-weight: 800;
    font-size: 7.8pt;
    height: 5.1mm;
  }

  .info-table .label {
    width: 27%;
    font-weight: 700;
    font-size: 7.15pt;
  }

  .info-table .value {
    width: 23%;
    font-size: 7.25pt;
  }

  .note {
    font-size: 7.7pt;
    font-weight: 700;
    margin: 1mm 0 0.9mm;
  }

  .awb-table {
    width: 100%;
    border: 0.4pt solid #888888;
  }

  .awb-table th,
  .awb-table td {
    border: 0.3pt solid #999999;
    padding: 0;
  }

  .awb-table th {
    background: #FFD966;
    height: 5.2mm;
    text-align: center;
    vertical-align: middle;
    font-size: 7.15pt;
    font-weight: 800;
    white-space: nowrap;
  }

  .awb-table .no-head {
    width: 5%;
  }

  .awb-table .awb-head {
    width: 19%;
  }

  .awb-table .row-no {
    width: 5%;
    height: 4.72mm;
    text-align: center;
    vertical-align: middle;
    font-size: 7.15pt;
  }

  .awb-table .awb-cell {
    width: 19%;
    height: 4.72mm;
    padding: 0 0.6mm;
    vertical-align: middle;
    font-size: 7pt;
    white-space: nowrap;
    overflow: hidden;
  }

  .total {
    height: 5.8mm;
    border-left: 0.35pt solid #777777;
    border-right: 0.35pt solid #777777;
    border-bottom: 0.35pt solid #777777;
    text-align: center;
    padding-top: 1.1mm;
    font-size: 7.35pt;
    font-weight: 700;
  }

  .total-line {
    display: inline-block;
    min-width: 34mm;
    height: 3mm;
    border-bottom: 0.5pt solid #111111;
    vertical-align: bottom;
    margin: 0 1mm;
  }

  .footer {
    margin-top: 3mm;
    font-size: 7pt;
    line-height: 1.18;
  }

  .footer .line { margin-top: 0.7mm; }

  .thank {
    text-align: right;
    margin-top: -3.7mm;
    margin-right: 2mm;
  }

  .city {
    text-align: right;
    margin-top: 3mm;
    margin-right: 5mm;
    font-size: 7.7pt;
    font-weight: 700;
  }

  .signature { margin-top: 1mm; }

  .signature td {
    width: 50%;
    border: none;
    vertical-align: top;
    font-size: 7.2pt;
    padding: 0 5mm;
  }

  .signature .left { text-align: left; }
  .signature .right { text-align: right; }

  .sign-gap { height: 12.5mm; }

  .sign-name { font-weight: 700; }
  .small { font-size: 6.8pt; }
</style>
</head>

<body>
<div class="page">

  <div class="top">
    <div class="system">
      System-Based/ GunScanner/ 按系统 / 把扫描
    </div>

    <div class="logo">
      J&amp;T<small>EXPRESS</small>
    </div>

    <div class="date">
      HARI/TANGGAL 星期/日期: ${dateStr}
    </div>
  </div>

  <div class="title">
    FORM RETUR PENGEMBALIAN BARANG SELLER
  </div>

  <div class="subtitle">
    交接单 - 网点跟卖家
  </div>

  <table class="info-table">
    <tr>
      <td class="section" colspan="2">DATA DROPPOINT 网点明细</td>
      <td class="section" colspan="2">DATA SELLER 卖家明细</td>
    </tr>

    <tr>
      <td class="label">DROPPOINT 网点名称</td>
      <td class="value">${safeDropPoint}</td>
      <td class="label">NAMA SELLER DI SISTEM 卖家名称</td>
      <td class="value">${safeSeller}</td>
    </tr>

    <tr>
      <td class="label">NAMA LENGKAP SPRINTER 名称</td>
      <td class="value">${safeSprinter}</td>
      <td class="label">NAMA PENERIMA 名称</td>
      <td class="value">${safeReceiver}</td>
    </tr>

    <tr>
      <td class="label">NO HP SPRINTER 电话号码</td>
      <td class="value">${safeSprinterPhone}</td>
      <td class="label">NO HP 电话号码</td>
      <td class="value">${safeSellerPhone}</td>
    </tr>
  </table>

  <div class="note">
    Keterangan: Paket sudah diserahkan ke PIC Seller
  </div>

  <table class="awb-table">
    <thead>
      <tr>
        <th class="no-head">NO</th>
        <th class="awb-head">AWB 面单号码</th>
        <th class="awb-head">AWB 面单号码</th>
        <th class="awb-head">AWB 面单号码</th>
        <th class="awb-head">AWB 面单号码</th>
        <th class="awb-head">AWB 面单号码</th>
      </tr>
    </thead>
    <tbody>
      ${awbGridRows}
    </tbody>
  </table>

  <div class="total">
    总共多少票已交接 TOTAL barang yang telah dikembalikan
    <span class="total-line">${totalAwb}</span>
    AWB (票)
  </div>

  <div class="footer">
    <div>Diatas adalah Data No AWB yang telah kami serahkan kepada PIC Seller.</div>
    <div class="line">Form ini sebagai bukti untuk serah terima barang yang telah diretur oleh sprinter DP</div>
    <div class="line">以上单号的货物已经交接给卖家的负责人并验收。这张表格是作为网点退回货物的证明而创建的</div>
    <div class="thank">Terima kasih. 谢谢</div>
  </div>

  <div class="city">
    Batang ,
  </div>

  <table class="signature">
    <tr>
      <td class="left">
        网点 DP<br>
        Yang Membuat

        <div class="sign-gap"></div>

        <div class="sign-name">
          ${safeSprinter}
        </div>
      </td>

      <td class="right">
        卖家 Seller<br>
        Yang Menerima

        <div class="sign-gap"></div>

        <div class="sign-name">
          (Nama lengkap) 名字
        </div>

        <div class="small">
          (PIC Seller) 卖家负责人
        </div>
      </td>
    </tr>
  </table>

</div>
</body>
</html>`;

  const blob = Utilities
    .newBlob(htmlBody, MimeType.HTML)
    .setName(manifestNumber + '.pdf')
    .getAs(MimeType.PDF);

  const year = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy');
  const month = Utilities.formatDate(now, 'Asia/Jakarta', 'MM');
  const day = Utilities.formatDate(now, 'Asia/Jakarta', 'dd');

  const targetFolder = getOrCreateFolder(
    'MANIFEST_RETUR/PDF/' + year + '/' + month + '/' + day
  );

  const file = targetFolder.createFile(blob);

  file.setSharing(
    DriveApp.Access.ANYONE_WITH_LINK,
    DriveApp.Permission.VIEW
  );

  return {
    id: file.getId(),
    url: file.getUrl()
  };
}

function createJsonResponse(responseObj) {
  const finalResponse = {
    success: responseObj.success !== undefined
      ? responseObj.success
      : true,
    data: responseObj.data !== undefined
      ? responseObj.data
      : null,
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
