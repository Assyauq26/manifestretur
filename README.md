# Manifest Retur

Aplikasi mobile-first untuk proses manifest retur dan serah terima paket.

## Current stack

- React + Vite + Tailwind CSS
- React Router HashRouter
- Google Apps Script REST endpoint
- Google Sheets + Google Drive
- html5-qrcode untuk scanning AWB

## Current phase

Phase 1-6 sudah berjalan menurut project handover. Phase 7 (Hand Over & Evidence Capture) sudah memiliki frontend di `src/App.jsx` dan modul backend GAS di `apps-script/Phase7_Handover.gs`.

## Phase 7 frontend contract

The `/handover` page uses these backend actions:

- `getReadyHandover`
- `completeHandover`

`completeHandover` menerima:

- `userToken`
- `manifestNumber`
- `photoBase64`
- `signatureBase64`
- `handoverBy`

Backend validates the session token and manifest scope, requires `READY_HANDOVER`, stores photo/signature evidence in Google Drive, then changes the manifest status to `COMPLETED`.

## Google Apps Script integration

`apps-script/Phase7_Handover.gs` is an additive module. It is intended to be added to the existing GAS project without replacing the existing login, seller, manifest, or PDF functions.

Add these cases to the existing `doPost` action router:

```javascript
case 'getReadyHandover':
  return phase7_json_(phase7_getReadyHandover_(payload));
case 'completeHandover':
  return phase7_json_(phase7_completeHandover_(payload));
```

Keep the existing `doPost` response/error wrapper if the current backend already has one.

## Evidence storage

The Phase 7 module creates this Drive structure when needed:

`MANIFEST_RETUR/HANDOVER/YYYY/MM/DD/<MANIFEST_NUMBER>/`

Files:

- `<MANIFEST_NUMBER>_bukti.*`
- `<MANIFEST_NUMBER>_signature.png`

The generated URLs are written to optional `MANIFEST` columns:

- `handover_at`
- `handover_by`
- `handover_photo_url`
- `handover_signature_url`

## Deployment

Netlify builds the frontend with `npm run build` and publishes `dist`. The live preview is deployed from the GitHub `main` branch.
