# Manifest Retur

Aplikasi mobile-first untuk proses manifest retur dan serah terima paket.

## Current stack

- React + Vite + Tailwind CSS
- React Router HashRouter
- Google Apps Script REST endpoint
- Google Sheets + Google Drive
- html5-qrcode untuk scanning AWB

## Current phase

Phase 1-6 sudah berjalan menurut project handover. Phase 7 (Hand Over & Evidence Capture) sekarang sudah diimplementasikan pada frontend di `src/App.jsx`.

## Phase 7 frontend contract

The `/handover` page expects these backend actions:

- `getReadyHandover`
- `completeHandover`

`completeHandover` menerima:

- `userToken`
- `manifestNumber`
- `photoBase64`
- `signatureBase64`
- `handoverBy`

Backend should validate the session token and the manifest status before changing `READY_HANDOVER` to `COMPLETED`.
