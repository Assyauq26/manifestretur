# Project Status & Handover: Manifest Retur (J&T Express)

**Date:** September 25, 2026  
**Canonical branch:** `main`  
**Target Platform:** Mobile-first Web Application (React + Vite + Tailwind CSS + Google Apps Script + Google Sheets & Drive)

## 1. Current architecture

The repository uses `main` as the single source of truth. The frontend and Apps Script backend are modularized so the old monolithic `Code.gs` does not need to be copied back into Apps Script.

### Apps Script

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

Responsibilities:

- `Auth.gs`: authentication and session token handling.
- `Kode.gs`: REST router, seller lookup, manifest generation, AWB persistence, shared response helpers.
- `Handover.gs`: READY_HANDOVER and COMPLETE_HANDOVER, receiver name, handwritten signature, evidence photo, status transition.
- `ManifestHistory.gs`: read-only Manifest and Riwayat endpoints.
- `PdfTemplateOverride.gs`: the only `generatePdfDrive()` implementation.
- `SchemaSetup.gs`: additive schema creation/migration.
- `appsscript.json`: runtime, OAuth scopes and web app configuration.

### Frontend

- `src/App.jsx`: authentication, Home, manifest creation and scanner flow.
- `src/HandoverPageV3.jsx`: canonical handover UI.
- `src/ManifestPage.jsx`: Manifest menu.
- `src/HistoryPage.jsx`: Riwayat menu.
- `src/main.jsx`: route bridge for the three canonical pages while retaining the existing HashRouter application.

## 2. Manifest creation

The manifest is generated with status `READY_HANDOVER`.

The initial PDF is created immediately and stored in:

`MANIFEST_RETUR/PDF/YYYY/MM/DD/`

The actual PIC Seller receiver name is intentionally **not** taken from the dummy/old `SELLER_MASTER.receiver_name` value when creating the manifest. The handover user enters the actual receiver name later.

## 3. Handover flow

The canonical handover flow is:

1. Load manifests with `READY_HANDOVER` status.
2. Open one manifest.
3. Enter **Nama Penerima (PIC Seller)**.
4. PIC Seller signs with a finger in the signature canvas.
5. Capture the handover photo.
6. Submit `completeHandover`.
7. Backend validates session, manifest status and user scope.
8. Backend regenerates the manifest PDF with the actual receiver name and signature on page 1.
9. The handover photo is embedded as the final page of the PDF.
10. No standalone photo/signature evidence file is created in Drive.
11. Manifest status changes to `COMPLETED`.
12. The old pre-handover PDF is moved to trash after the final PDF is created.
13. The frontend shows a custom success modal with PDF, WhatsApp share, Home, and stay-on-Handover actions.

## 4. PDF rules

- J&T Express logo is rendered as an image data URI on both pages.
- The first-page logo uses constrained dimensions so the top is not clipped.
- Sprinter display is normalized from `Ahmad Sprinter` to:

```text
Ahmad
(Sprinter)
```

- Initial receiver field is blank/unknown until handover.
- Final receiver field uses the actual handover input.
- Final signature uses the hand-drawn PIC Seller signature.
- The original manifest date is preserved when the PDF is regenerated.
- Page 2/final page contains the handover metadata and photo evidence.

## 5. Manifest and Riwayat

Backend actions:

- `getManifests`
- `getHistory`

Both enforce session validation and scope the data to the logged-in sprinter/drop point, while ADMIN can access the full dataset.

Frontend menus provide:

- Search by manifest number/seller.
- Status filter for Manifest (`READY_HANDOVER` / `COMPLETED`).
- PDF access.
- Receiver and handover status information.
- Manifest creation and handover timestamps in Riwayat.

## 6. Database migration

`SchemaSetup.gs` is additive. It adds missing columns without deleting existing data.

The canonical `HANDOVER` schema is:

```text
handover_id
manifest_id
seller_id
seller_name
receiver_name
handover_at
handover_by
photo_file_id
photo_url
signature_data
notes
status
```

Run `migrateDatabaseSchema()` or `migrateHandoverSchema()` once after synchronizing Apps Script if these columns are not yet present.

Do not run `seedDummyData()` against production data.

## 7. Known fixes included

- Duplicate/global `generatePdfDrive()` ownership removed from the architecture.
- Receiver name is dynamic at handover instead of hardcoded dummy data.
- PIC Seller signature restored.
- Signature pointer coordinates are mapped from the visible canvas rectangle to its drawing buffer to prevent finger/stroke displacement on mobile DPI/zoom configurations.
- Native browser `alert()` completion flow replaced by the custom success modal in the canonical V3 page.
- Post-handover navigation has explicit Home and menu navigation actions.
- Manifest and Riwayat pages are no longer placeholder pages when accessed through the canonical route bridge.

## 8. Deployment

The Apps Script GitHub Actions workflow watches `main` and synchronizes `apps-script/**` to the configured Apps Script project when the repository credentials are available.

Netlify uses the repository frontend build. After a main-branch push, allow the deployment pipeline to finish before testing the public site.

For manual Apps Script synchronization, copy only the canonical files from `apps-script/` on `main`; do not mix files from the old `fix/handover-navigation-signature` branch.
