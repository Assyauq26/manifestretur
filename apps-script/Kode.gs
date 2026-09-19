/**
 * MANIFEST RETUR - GOOGLE APPS SCRIPT BACKEND
 *
 * Phase 1-6: database/API, seller, manifest, AWB and PDF.
 * Phase 7: routing is delegated to Handover.gs (V2 canonical implementation).
 * Authentication is delegated to Auth.gs.
 */

const PHASE7_READY_STATUS = 'READY_HANDOVER';
const PHASE7_COMPLETED_STATUS = 'COMPLETED';

/**
 * CORS preflight.
 */
function doOptions(e) {
  return createJsonResponse({
    success: true,
    message: 'CORS OK'
  });
}

/**
 * Main JSON API router.
 *
 * IMPORTANT:
 * - handleLogin() lives in Auth.gs.
 * - Phase 7 handlers live in Handover.gs as V2.
 */
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

/**
 * Health check.
 */
function doGet(e) {
  return createJsonResponse({
    success: true,
    message: 'API Running'
  });
}

/**
 * Get active sellers.
 */
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
    if (String(row[statusIdx] || '').trim().toUpperCase() !== 'ACTIVE') {
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

/**
 * Create manifest, store AWBs and generate PDF.
 */
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
      String(sellerData[i][sellerStatusIdx] || '').trim().toUpperCase() === 'ACTIVE'
    ) {
      sellerInfo = sellerData[i];
      break;
    }
  }

  if (!sellerInfo) {
    return createErrorResponse('Seller tidak ditemukan atau tidak aktif.');
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
    const manifestNumberIdx = manifestHeaders.indexOf('manifest_number');

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

/**
 * Drive folder helper for generated manifest PDFs.
 */
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

/**
 * Generate manifest PDF and store it in Drive.
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
    'dd MMMM yyyy'
  );

  let htmlBody = `
    <html>
      <head>
        <style>
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
        </style>
      </head>
      <body>
        <div class="top-header">
          <div>System-Based / GunScanner</div>
          <div style="color:#D71920;font-size:12px;font-weight:bold;">J&T EXPRESS</div>
        </div>

        <div style="font-size:10px;margin-bottom:10px;">
          <strong>HARI/TANGGAL:</strong> ${dateStr}
        </div>

        <div class="title">
          FORM RETUR PENGEMBALIAN BARANG SELLER
        </div>

        <table class="info-table">
          <tr>
            <td class="bg-header">DATA DROPPOINT</td>
            <td class="bg-header">DATA SELLER</td>
          </tr>
          <tr>
            <td><strong>DROPPOINT:</strong> ${user.drop_point_id}</td>
            <td><strong>NAMA SELLER DI SISTEM:</strong> ${sellerName}</td>
          </tr>
          <tr>
            <td><strong>NAMA LENGKAP SPRINTER:</strong> ${user.nama_sprinter}</td>
            <td><strong>NAMA PENERIMA:</strong> ${receiverName}</td>
          </tr>
          <tr>
            <td><strong>NO HP SPRINTER:</strong> ${user.no_hp}</td>
            <td><strong>NO HP:</strong> ${sellerPhone}</td>
          </tr>
        </table>

        <div class="note">
          Keterangan: Paket sudah diserahkan ke PIC Seller.
        </div>

        <table>
          <tr>
            <th class="bg-yellow" style="width:4%">NO</th>
            <th class="bg-yellow" style="width:21%">AWB</th>
            <th class="bg-yellow" style="width:4%">NO</th>
            <th class="bg-yellow" style="width:21%">AWB</th>
            <th class="bg-yellow" style="width:4%">NO</th>
            <th class="bg-yellow" style="width:21%">AWB</th>
            <th class="bg-yellow" style="width:4%">NO</th>
            <th class="bg-yellow" style="width:21%">AWB</th>
          </tr>`;

  const colCount = 4;
  const rowCount = Math.ceil(awbs.length / colCount);
  const totalRows = Math.max(rowCount, 10);

  for (let i = 0; i < totalRows; i++) {
    htmlBody += '<tr>';

    for (let c = 0; c < colCount; c++) {
      const itemIndex = (i * colCount) + c;
      const currentAwb = awbs[itemIndex] || '';
      const displayNo = itemIndex < awbs.length
        ? itemIndex + 1
        : '';

      htmlBody +=
        '<td style="text-align:center;background-color:#f9f9f9;">' +
        displayNo +
        '</td><td>' +
        currentAwb +
        '</td>';
    }

    htmlBody += '</tr>';
  }

  htmlBody += `
        </table>

        <div style="font-weight:bold;margin-bottom:10px;font-size:10px;">
          TOTAL barang yang telah dikembalikan: ${awbs.length} AWB
        </div>

        <div class="footer-note">
          Diatas adalah Data No AWB yang telah kami serahkan kepada PIC Seller.<br>
          Form ini sebagai bukti untuk serah terima barang yang telah diretur oleh sprinter DP.<br>
          Semarang, ....................................................
        </div>

        <table class="sign-table">
          <tr>
            <td>
              <strong>Yang Membuat</strong><br><br><br><br>
              <strong>(${user.nama_sprinter})</strong><br>
              <span style="font-size:8px;">SPV DP / ADMIN / SPRINTER</span>
            </td>
            <td>
              <strong>Yang Menerima</strong><br><br><br><br>
              <strong>( _________________________________ )</strong><br>
              <span style="font-size:8px;">(PIC Seller) / Penanggung Jawab</span>
            </td>
          </tr>
        </table>
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

/**
 * Standard JSON response helper used by all Apps Script files.
 */
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

/**
 * Standard error response helper.
 * HTTP status cannot be directly controlled by ContentService;
 * the optional code is retained for caller semantics.
 */
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
