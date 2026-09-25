/**
 * MANIFEST PDF TEMPLATE - CANONICAL MAIN VERSION
 *
 * Initial PDF: manifest pages contain the physical-form layout with a blank
 * receiver/signature because the actual PIC Seller is entered during handover.
 *
 * Final PDF: the same manifest pages are regenerated with the actual receiver
 * name and handwritten PIC Seller signature. The handover photo is appended
 * as the final page. Photo/signature are not stored as separate Drive files.
 *
 * Pagination rule:
 * - 5 AWB columns x 35 rows = maximum 175 AWB per manifest page.
 * - If AWB > 175, additional manifest pages are created automatically.
 * - The receiver signature is rendered on the LAST manifest page only.
 * - The handover photo remains on a separate final page.
 */

function getJTLogoDataUriOverride_() {
  const logoUrl = 'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/J%26T_Express_logo.svg';
  const response = UrlFetchApp.fetch(logoUrl, { muteHttpExceptions: true });

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Gagal mengambil logo J&T Express dari Wikimedia Commons. HTTP ' + response.getResponseCode());
  }

  return 'data:image/svg+xml;base64,' + Utilities.base64Encode(response.getBlob().getBytes());
}

function getSprinterDisplayNameForPdf_(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  return raw.replace(/\s*(?:[-–—]\s*)?sprinter\s*$/i, '').trim() || raw;
}

function buildManifestAwbGridHtml_(awbs, startIndex, rowCount) {
  const columns = 5;
  let html = '';

  for (let row = 0; row < rowCount; row++) {
    const rowNumber = row + 1;
    html += '<tr><td class="row-no">' + rowNumber + '</td>';

    for (let col = 0; col < columns; col++) {
      const index = startIndex + (row * columns) + col;
      const value = index < awbs.length ? escapePdfHtml_(awbs[index]) : '';
      html += '<td class="awb-cell">' + value + '</td>';
    }

    html += '</tr>';
  }

  return html;
}

function buildManifestPageHtml_(params) {
  const {
    manifestNumber,
    dateStr,
    safeDropPoint,
    safeSprinter,
    safeSprinterPhone,
    safeSeller,
    finalReceiver,
    safeSellerPhone,
    awbs,
    startIndex,
    rowCount,
    pageNumber,
    totalPages,
    isLastManifestPage,
    handoverCompleted,
    signatureHtml
  } = params;

  const endIndex = Math.min(startIndex + (rowCount * 5), awbs.length);
  const pageStartAwb = startIndex + 1;
  const pageEndAwb = endIndex;

  const manifestNote = handoverCompleted
    ? 'Keterangan: Paket sudah diserahkan kepada PIC Seller.'
    : 'Keterangan: Manifest dibuat dan menunggu serah terima kepada PIC Seller.';

  const pageSummary = isLastManifestPage
    ? 'TOTAL barang yang telah dikembalikan: <strong>' + awbs.length + ' AWB</strong>'
    : 'AWB halaman ini: <strong>' + pageStartAwb + ' - ' + pageEndAwb + '</strong>';

  const lastClass = isLastManifestPage ? ' page-last' : '';

  return `
<div class="manifest-page${lastClass}">
  <div class="top">
    <div class="system">System-Based/ GunScanner/ 按系统 / 把扫描</div>
    <img class="logo-image" src="${params.logoDataUri}" alt="J&T Express" />
    <div class="date">HARI/TANGGAL 星期/日期: ${dateStr}</div>
    <div class="page-number">Halaman ${pageNumber}/${totalPages}</div>
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
      <td class="value">${safeSprinter} <span class="role">(Sprinter)</span></td>
      <td class="label">NAMA PENERIMA 名称</td>
      <td class="value">${finalReceiver}</td>
    </tr>
    <tr>
      <td class="label">NO HP SPRINTER 电话号码</td>
      <td class="value">${safeSprinterPhone}</td>
      <td class="label">NO HP 电话号码</td>
      <td class="value">${safeSellerPhone}</td>
    </tr>
  </table>

  <div class="note">${manifestNote}</div>

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
    <tbody>${buildManifestAwbGridHtml_(awbs, startIndex, rowCount)}</tbody>
  </table>

  <div class="total">
    ${pageSummary}
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
        <div class="sign-role">(Sprinter)</div>
      </td>
      <td class="right">
        卖家 Seller<br>
        Yang Menerima
        <div class="sign-gap"></div>
        ${isLastManifestPage ? signatureHtml : '<div class="signature-continued">Dilanjutkan ke halaman berikutnya</div>'}
        ${isLastManifestPage ? '<div class="sign-name">' + finalReceiver + '</div><div class="sign-role">(PIC Seller)</div>' : ''}
      </td>
    </tr>
  </table>
</div>`;
}

function generatePdfDrive(manifestNumber, user, sellerName, receiverName, sellerPhone, awbs, options) {
  options = options || {};
  awbs = Array.isArray(awbs) ? awbs : [];
  user = user || {};

  const now = new Date();
  const sourceDate = options.manifestDate ? new Date(options.manifestDate) : now;
  const dateStr = !isNaN(sourceDate.getTime())
    ? Utilities.formatDate(sourceDate, 'Asia/Jakarta', 'dd/MM/yyyy')
    : Utilities.formatDate(now, 'Asia/Jakarta', 'dd/MM/yyyy');

  const logoDataUri = getJTLogoDataUriOverride_();
  const safeDropPoint = escapePdfHtml_(user.drop_point_id || '');
  const sprinterName = getSprinterDisplayNameForPdf_(user.nama_sprinter || '');
  const safeSprinter = escapePdfHtml_(sprinterName);
  const safeSprinterPhone = escapePdfHtml_(user.no_hp || '');
  const safeSeller = escapePdfHtml_(sellerName || '');
  const safeReceiver = escapePdfHtml_(receiverName || '');
  const safeSellerPhone = escapePdfHtml_(sellerPhone || '');
  const finalReceiver = safeReceiver || '-';

  if (options.handoverPhotoBase64) {
    validateHandoverPhoto_(options.handoverPhotoBase64);
    if (!options.signatureData) {
      throw new Error('Tanda tangan PIC Seller wajib tersedia untuk PDF final.');
    }
    validateHandoverSignature_(options.signatureData);
  }

  const handoverCompleted = Boolean(options.handoverPhotoBase64 && options.signatureData);
  const signatureHtml = options.signatureData
    ? '<img class="signature-image" src="' + options.signatureData + '" alt="Tanda tangan PIC Seller" />'
    : '<div class="signature-placeholder">Belum serah terima</div>';

  // Physical form capacity: 5 columns x 35 rows = 175 AWB per page.
  const rowsPerPage = 35;
  const awbsPerPage = rowsPerPage * 5;
  const totalPages = Math.max(1, Math.ceil(awbs.length / awbsPerPage));
  const manifestPages = [];

  for (let page = 0; page < totalPages; page++) {
    const startIndex = page * awbsPerPage;
    const remaining = Math.max(0, awbs.length - startIndex);
    const rowCount = Math.min(rowsPerPage, Math.max(1, Math.ceil(remaining / 5)));
    const isLastManifestPage = page === totalPages - 1;

    manifestPages.push(buildManifestPageHtml_({
      manifestNumber,
      dateStr,
      safeDropPoint,
      safeSprinter,
      safeSprinterPhone,
      safeSeller,
      finalReceiver,
      safeSellerPhone,
      awbs,
      startIndex,
      rowCount,
      pageNumber: page + 1,
      totalPages,
      isLastManifestPage,
      handoverCompleted,
      signatureHtml,
      logoDataUri
    }));
  }

  let handoverPage = '';

  if (options.handoverPhotoBase64) {
    const handoverAt = options.handoverAt ? new Date(options.handoverAt) : now;
    const handoverDate = !isNaN(handoverAt.getTime())
      ? Utilities.formatDate(handoverAt, 'Asia/Jakarta', 'dd/MM/yyyy HH:mm')
      : Utilities.formatDate(now, 'Asia/Jakarta', 'dd/MM/yyyy HH:mm');

    const safeHandoverBy = escapePdfHtml_(
      options.handoverBy
        ? getSprinterDisplayNameForPdf_(options.handoverBy)
        : sprinterName
    );
    const safeHandoverReceiver = escapePdfHtml_(options.receiverName || receiverName || '');

    handoverPage = `
<div class="handover-page">
  <img class="handover-logo-image" src="${logoDataUri}" alt="J&T Express" />
  <div class="handover-title">BUKTI SERAH TERIMA MANIFEST RETUR</div>
  <div class="handover-subtitle">DOKUMENTASI SERAH TERIMA BARANG KEPADA PIC SELLER</div>

  <table class="handover-info">
    <tr><td class="label">Nomor Manifest</td><td>${escapePdfHtml_(manifestNumber)}</td></tr>
    <tr><td class="label">Seller</td><td>${safeSeller}</td></tr>
    <tr><td class="label">PIC Seller / Penerima</td><td>${safeHandoverReceiver}</td></tr>
    <tr><td class="label">Sprinter / Penyerah</td><td>${safeHandoverBy} <span class="role">(Sprinter)</span></td></tr>
    <tr><td class="label">Tanggal & Waktu</td><td>${handoverDate}</td></tr>
    <tr><td class="label">Status</td><td><strong>SUDAH DISERAHKAN</strong></td></tr>
  </table>

  <div class="photo-caption">FOTO BUKTI SERAH TERIMA</div>
  <div class="photo-frame"><img src="${options.handoverPhotoBase64}" alt="Bukti serah terima" /></div>
  <div class="handover-note">Foto ini merupakan bagian dari PDF manifest dan digunakan sebagai bukti dokumentasi serah terima.</div>
</div>`;
  }

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size:A4 portrait; margin:4.5mm 4.5mm 4mm 4.5mm; }
  * { box-sizing:border-box; }
  html, body { margin:0; padding:0; background:#fff; color:#111; font-family:Arial,"Noto Sans",sans-serif; font-size:8pt; line-height:1.02; }

  .manifest-page {
    width:100%;
    min-height:278mm;
    page-break-after:always;
    break-after:page;
    page-break-inside:avoid;
    break-inside:avoid;
    overflow:hidden;
  }
  .manifest-page.page-last { page-break-after:auto; break-after:auto; }

  .top { position:relative; height:16mm; }
  .system { position:absolute; top:0; left:0; font-size:7pt; font-weight:700; white-space:nowrap; }
  .logo-image { position:absolute; top:-0.5mm; right:6mm; width:42mm; max-height:12mm; height:auto; object-fit:contain; object-position:center; display:block; }
  .date { position:absolute; left:0; bottom:0; font-size:7.5pt; font-weight:700; }
  .page-number { position:absolute; right:0; bottom:0; font-size:6.7pt; color:#555; }
  .title { text-align:center; font-size:10.2pt; font-weight:800; margin-top:.3mm; }
  .subtitle { text-align:center; font-size:7.7pt; margin-top:.6mm; margin-bottom:1.5mm; }

  table { width:100%; border-collapse:collapse; table-layout:fixed; }
  .info-table { margin-bottom:1.5mm; }
  .info-table td { border:.35pt solid #777; padding:.45mm .7mm; height:4.1mm; vertical-align:middle; white-space:nowrap; overflow:hidden; }
  .info-table .section { background:#B4C7E7; font-weight:800; font-size:7.5pt; height:4.5mm; }
  .info-table .label { width:27%; font-weight:700; font-size:6.8pt; }
  .info-table .value { width:23%; font-size:7pt; }
  .role { color:#444; }

  .note { font-size:7.3pt; font-weight:700; margin:.8mm 0 .7mm; }
  .awb-table { width:100%; border:.4pt solid #888; }
  .awb-table th,.awb-table td { border:.3pt solid #999; padding:0; }
  .awb-table th { background:#FFD966; height:4.6mm; text-align:center; vertical-align:middle; font-size:6.8pt; font-weight:800; white-space:nowrap; }
  .awb-table .no-head { width:5%; }
  .awb-table .awb-head { width:19%; }
  .awb-table .row-no { width:5%; height:4.15mm; text-align:center; vertical-align:middle; font-size:6.8pt; }
  .awb-table .awb-cell { width:19%; height:4.15mm; padding:0 .5mm; vertical-align:middle; font-size:6.7pt; white-space:nowrap; overflow:hidden; }

  .total { min-height:5mm; border-left:.35pt solid #777; border-right:.35pt solid #777; border-bottom:.35pt solid #777; text-align:center; padding-top:.8mm; font-size:7pt; font-weight:700; }
  .footer { margin-top:1.8mm; font-size:6.7pt; line-height:1.12; }
  .footer .line { margin-top:.45mm; }
  .thank { text-align:right; margin-top:-3.1mm; margin-right:2mm; }
  .city { text-align:right; margin-top:1.7mm; margin-right:5mm; font-size:7.3pt; font-weight:700; }

  .signature { margin-top:.7mm; page-break-inside:avoid; break-inside:avoid; }
  .signature td { width:50%; border:none; vertical-align:top; font-size:6.9pt; padding:0 5mm; }
  .signature .left { text-align:left; }
  .signature .right { text-align:right; }
  .sign-gap { height:5mm; }
  .sign-name { font-weight:700; }
  .sign-role { font-size:6.5pt; margin-top:.35mm; }
  .signature-placeholder { color:#777; font-size:6.4pt; padding-top:2mm; }
  .signature-image { display:block; width:30mm; height:12mm; object-fit:contain; margin:0 0 .5mm auto; }
  .signature-continued { color:#777; font-size:6.5pt; padding-top:2mm; }

  .handover-page {
    width:100%;
    min-height:278mm;
    page-break-before:always;
    break-before:page;
    text-align:center;
    padding-top:2mm;
    page-break-inside:avoid;
    break-inside:avoid;
  }
  .handover-logo-image { display:block; width:44mm; max-height:14mm; height:auto; object-fit:contain; object-position:center; margin:0 auto 4mm; }
  .handover-title { font-size:14pt; font-weight:900; }
  .handover-subtitle { font-size:8pt; margin-top:1.5mm; color:#555; }
  .handover-info { margin:7mm auto 4mm; width:88%; font-size:9pt; text-align:left; }
  .handover-info td { border:.5pt solid #999; padding:2mm; }
  .handover-info .label { width:38%; font-weight:700; background:#f3f4f6; }
  .photo-caption { font-size:9pt; font-weight:800; margin:4mm 0 2mm; }
  .photo-frame { width:88%; height:142mm; margin:0 auto; border:.8pt solid #777; padding:3mm; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .photo-frame img { max-width:100%; max-height:100%; width:auto; height:auto; object-fit:contain; display:block; }
  .handover-note { width:88%; margin:3mm auto 0; font-size:7.5pt; color:#555; line-height:1.3; }
</style>
</head>
<body>
${manifestPages.join('\n')}
${handoverPage}
</body>
</html>`;

  const blob = Utilities.newBlob(htmlBody, MimeType.HTML)
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
