/**
 * Manifest PDF template override.
 *
 * Keeps the existing generateManifest flow intact while replacing only the
 * PDF layout with the approved 35-row physical form layout.
 * The function name intentionally matches the legacy generator so the final
 * global declaration is the active implementation in Apps Script.
 */

function getJTLogoDataUriOverride_() {
  const logoUrl = 'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/J%26T_Express_logo.svg';
  const response = UrlFetchApp.fetch(logoUrl, { muteHttpExceptions: true });

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Gagal mengambil logo J&T Express dari Wikimedia Commons. HTTP ' + response.getResponseCode());
  }

  return 'data:image/svg+xml;base64,' + Utilities.base64Encode(response.getBlob().getBytes());
}

function generatePdfDrive(
  manifestNumber,
  user,
  sellerName,
  receiverName,
  sellerPhone,
  awbs
) {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd/MM/yyyy');

  const safeDropPoint = escapePdfHtml_(user.drop_point_id || '');
  const safeSprinter = escapePdfHtml_(user.nama_sprinter || '');
  const safeSprinterPhone = escapePdfHtml_(user.no_hp || '');
  const safeSeller = escapePdfHtml_(sellerName || '');
  const safeReceiver = escapePdfHtml_(receiverName || '');
  const safeSellerPhone = escapePdfHtml_(sellerPhone || '');

  const totalRows = 35;
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

  .logo-image {
    position: absolute;
    top: -1mm;
    right: 7mm;
    width: 39mm;
    height: auto;
    display: block;
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

  .awb-table .no-head { width: 5%; }
  .awb-table .awb-head { width: 19%; }

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
    <div class="system">System-Based/ GunScanner/ 按系统 / 把扫描</div>
    <img class="logo-image" src="${getJTLogoDataUriOverride_()}" alt="J&T Express" />
    <div class="date">HARI/TANGGAL 星期/日期: ${dateStr}</div>
  </div>

  <div class="title">FORM RETUR PENGEMBALIAN BARANG SELLER</div>
  <div class="subtitle">交接单 - 网点跟卖家</div>

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

  <div class="note">Keterangan: Paket sudah diserahkan ke PIC Seller</div>

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
    <tbody>${awbGridRows}</tbody>
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

  <div class="city">Batang ,</div>

  <table class="signature">
    <tr>
      <td class="left">
        网点 DP<br>
        Yang Membuat
        <div class="sign-gap"></div>
        <div class="sign-name">${safeSprinter}</div>
      </td>
      <td class="right">
        卖家 Seller<br>
        Yang Menerima
        <div class="sign-gap"></div>
        <div class="sign-name">(Nama lengkap) 名字</div>
        <div class="small">(PIC Seller) 卖家负责人</div>
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

  const targetFolder = getOrCreateFolder('MANIFEST_RETUR/PDF/' + year + '/' + month + '/' + day);
  const file = targetFolder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    id: file.getId(),
    url: 'https://drive.google.com/uc?export=download&id=' + file.getId()
  };
}
