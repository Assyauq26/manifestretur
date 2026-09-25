# Manifest Retur

Aplikasi mobile-first untuk proses manifest retur dan serah terima paket.

## Canonical branch

**`main` adalah satu-satunya branch yang menjadi source of truth untuk implementasi aktif.**

Branch eksperimen lama tidak menjadi referensi untuk copy/paste Apps Script. Untuk sinkronisasi manual ke Google Apps Script, gunakan file di `apps-script/` pada branch `main`.

## Stack

- React + Vite + Tailwind CSS
- React Router HashRouter untuk flow utama
- Google Apps Script sebagai REST backend
- Google Sheets sebagai database operasional
- Google Drive untuk penyimpanan PDF manifest
- html5-qrcode untuk scanning AWB

## Canonical Apps Script modules

```text
apps-script/
├── Auth.gs
├── Kode.gs
├── Handover.gs
├── ManifestHistory.gs
├── PdfTemplateOverride.gs
├── SchemaSetup.gs
└── appsscript.json
```

Tanggung jawab utama:

- `Auth.gs` — login dan session token.
- `Kode.gs` — API router, seller, generate manifest, AWB, response helpers.
- `Handover.gs` — READY_HANDOVER dan COMPLETE_HANDOVER dengan nama penerima, TTD PIC Seller, dan foto.
- `ManifestHistory.gs` — API read-only untuk menu Manifest dan Riwayat.
- `PdfTemplateOverride.gs` — satu-satunya generator PDF manifest.
- `SchemaSetup.gs` — schema dan migration additive.
- `appsscript.json` — OAuth scopes dan konfigurasi web app.

## Handover flow

1. Manifest dibuat dengan status `READY_HANDOVER`.
2. PDF awal dibuat saat manifest dibuat.
3. Pada halaman Hand Over, user mengisi:
   - Nama lengkap PIC Seller/penerima.
   - Tanda tangan PIC Seller dengan jari.
   - Foto bukti serah terima.
4. Backend meregenerasi PDF manifest dengan data handover.
5. TTD penerima tampil pada halaman pertama PDF.
6. Foto bukti serah terima tampil pada halaman terakhir PDF.
7. Foto dan TTD tidak disimpan sebagai file Drive terpisah.
8. Manifest berubah menjadi `COMPLETED`.
9. PDF lama dipindahkan ke trash setelah PDF final berhasil dibuat.

## PDF rules

- Logo J&T Express diambil sebagai image data URI, bukan teks.
- Nama pembuat manifest ditampilkan sebagai:

```text
Ahmad
(Sprinter)
```

bukan `Ahmad Sprinter`.

- Nama penerima pada PDF awal kosong dan diisi secara dinamis saat handover.
- PDF final mempertahankan tanggal manifest asli pada halaman pertama.
- Halaman kedua/final menggunakan logo J&T Express dan dokumentasi foto handover.

## Frontend handover safeguards

`src/HandoverPageV3.jsx` adalah UI handover canonical. Signature pad memetakan koordinat pointer dari CSS pixels ke drawing buffer sehingga tetap sejajar pada perangkat mobile dengan DPI/zoom berbeda. Setelah handover berhasil, modal baru menyediakan PDF final, share WhatsApp, kembali ke Beranda, atau tetap di Hand Over.

`src/main.jsx` mengarahkan route `/handover`, `/manifests`, dan `/history` ke implementasi canonical tanpa page refresh.

## Manifest & Riwayat

- `getManifests` menyediakan filter status dan pencarian nomor manifest/seller.
- `getHistory` menyediakan pencarian riwayat manifest dan handover.
- Akses backend dibatasi berdasarkan session user; admin dapat melihat seluruh data, sedangkan sprinter dibatasi pada sprinter/drop point terkait.

## Database migration

Migration bersifat additive: kolom yang belum ada ditambahkan, data lama tidak dihapus.

Setelah mengganti Apps Script dengan file dari `main`, jalankan **`migrateDatabaseSchema()`** atau **`migrateHandoverSchema()`** sekali untuk memastikan kolom handover berikut tersedia:

```text
receiver_name
signature_data
```

Jangan menjalankan fungsi seed dummy pada database produksi.

## Deployment

Netlify membangun frontend dengan `npm run build` dan mempublikasikan `dist` dari repository `main`.

Google Apps Script harus menggunakan seluruh file pada `apps-script/` dari `main`, kemudian deployment web app perlu diperbarui agar deployment aktif memakai versi kode terbaru.
