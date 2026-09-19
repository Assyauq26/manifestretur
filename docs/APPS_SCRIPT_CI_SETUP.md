# Apps Script CI/CD Setup

Repository ini sudah memiliki GitHub Actions workflow di `.github/workflows/apps-script-deploy.yml`.

## Alur otomatis

Setiap push ke `main` yang mengubah `apps-script/**` akan:

1. checkout repository;
2. memasang `@google/clasp`;
3. memuat OAuth credentials dari GitHub Secret `CLASPRC_JSON`;
4. `clasp push --force` ke project Apps Script yang ditentukan oleh `.clasp.json`;
5. memperbarui deployment produksi yang ditentukan oleh `CLASP_DEPLOYMENT_ID`.

## GitHub Secrets yang diperlukan

Buka:

`GitHub repository → Settings → Secrets and variables → Actions → New repository secret`

Tambahkan:

### `CLASPRC_JSON`

Isi dengan seluruh isi file `.clasprc.json` hasil `clasp login` pada akun Google yang memiliki akses ke project Apps Script.

Jangan commit file ini ke repository. Isinya mengandung OAuth credentials/refresh token.

### `CLASP_DEPLOYMENT_ID`

Isi dengan Deployment ID dari deployment Web App produksi yang saat ini dipakai oleh frontend.

Gunakan Deployment ID yang sama setiap kali workflow melakukan update agar URL deployment tetap sama.

## Jika tidak menggunakan laptop

Satu kali proses mendapatkan `.clasprc.json` dapat dilakukan melalui environment cloud seperti GitHub Codespaces dari browser jika tersedia pada akun GitHub.

Setelah kedua secret selesai dibuat, tidak perlu lagi copy-paste source `.gs` ke editor Apps Script untuk perubahan berikutnya.

## Trigger

Automatic:

- push ke `main` dengan perubahan `apps-script/**`
- perubahan `.clasp.json`
- perubahan workflow ini sendiri

Manual:

- GitHub → Actions → Deploy Google Apps Script → Run workflow

## Catatan penting

Workflow menggunakan `clasp push --force`, sehingga source di Apps Script akan disinkronkan dengan source di repository. Karena itu, source backend Apps Script sebaiknya diedit di GitHub setelah CI/CD aktif, bukan diedit langsung di editor Apps Script.
