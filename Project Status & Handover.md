# Project Status & Handover: Manifest Retur (J&T Express)

**Date:** September 19, 2026  
**Target Platform:** Mobile-First Web Application (React + Vite + Tailwind CSS + Google Apps Script + Google Sheets & Drive)  
**Current Architect/Coach:** Gemini (Paid Tier, Mobile/Web context)

## 1. Project Context & Objectives

The **Manifest Retur** web application is designed for J&T Express field sprinters to digitize and streamline the return goods (retur) handover process from drop points to e-commerce sellers.

Key Operational Goals:
* Eliminate paper-based errors by scanning return airway bills (AWBs / resi).
* Automate the creation of official return manifest PDFs styled precisely like the official J&T physical forms (4-column layout, clean Indonesian localization, zero foreign characters).
* Securely store data in relational Google Sheets and archive generated PDFs automatically inside structured Google Drive directories (`MANIFEST_RETUR/PDF/YYYY/MM/DD/`).
* Provide clear role-based authentication and mobile-optimized UX.

## 2. Tech Stack & Architecture

* **Frontend:** Single-file React (`App.jsx`) utilizing `HashRouter`, Tailwind CSS, J&T Red `#D71920`, Lucide React, and `html5-qrcode`.
* **Backend:** Google Apps Script (GAS) acting as a serverless REST API (`doPost` / `doOptions`) connected to Google Sheets.
* **Database (Google Sheets):**
  * `SPRINTER_MASTER`: Employee/sprinter credentials and drop point assignments.
  * `SELLER_MASTER`: Registered sellers and receiver contacts.
  * `MANIFEST`: Master record of created manifests, status tracking, and PDF links.
  * `MANIFEST_AWB`: Relational mapping table for individual scanned AWB items.

## 3. Completed Phases & Implemented Features

* **Phase 1: Database & Backend Foundation**
  * Established Google Sheets schemas and modular Apps Script routing.
* **Phase 2: Authentication**
  * Secure login system (`handleLogin`) verifying sprinter usernames and password hashes against `SPRINTER_MASTER`, utilizing `CacheService` for session tokens.
* **Phase 3: Manifest Creation Form**
  * `/manifest/create` view allowing sprinters to select operational shifts (Pagi/Siang/Sore) and fetch active sellers dynamically from `SELLER_MASTER`. Read-only auto-fill for Sprinter name and Drop Point ID.
* **Phase 4: Manual AWB Input**
  * Instant text input validation, duplicate prevention, real-time item counter, and item deletion logic.
* **Phase 5: Continuous Camera Barcode Scanner**
  * Integrated `html5-qrcode` for continuous barcode scanning with audio/visual feedback.
* **Phase 6: PDF Generation & Google Drive Storage**
  * Automated backend PDF builder and Drive storage under `MANIFEST_RETUR/PDF/YYYY/MM/DD/`.
  * Interactive success modal with direct PDF access.
  * Mobile browser redirect/popup handling fixed.

## 4. Current Phase: Phase 7 — Hand Over & Evidence Capture

**Status: Frontend implemented; backend module prepared; GAS deployment/integration pending.**

Implemented in the frontend:
* `/handover` route.
* List of manifests with `READY_HANDOVER` status.
* Photo evidence capture using the device camera.
* Digital signature capture using a touch-friendly canvas.
* Submission flow using the authenticated session token.
* UI removes a completed manifest from the pending list.

Prepared in `apps-script/Phase7_Handover.gs`:
* `phase7_getReadyHandover_()`.
* `phase7_completeHandover_()`.
* Session validation through `CacheService`.
* Manifest scope validation by sprinter/drop point.
* Atomic status transition from `READY_HANDOVER` to `COMPLETED` using a script lock.
* Photo/signature upload to Google Drive.
* Automatic optional handover columns in `MANIFEST`.

Required GAS router actions:
* `getReadyHandover`.
* `completeHandover`.

## 5. Pending / Remaining Phases

* **Phase 7 completion:** Add the Phase 7 module to the existing GAS project, connect the two router actions, deploy the GAS web app, and test the full handover flow from a real manifest.
* **Phase 8: Retur Dashboard / Search App**
  * Admin search/filter for historical manifests and AWB tracking.
* **Phase 9: Polish & Hardening**
  * Final UI/UX review, error boundary hardening, payload/image-size handling, and production audit logs.

## 6. Next Implementation Order

1. Integrate `apps-script/Phase7_Handover.gs` into the existing GAS backend.
2. Deploy the updated GAS Web App using the existing endpoint or a new version.
3. Test `getReadyHandover` with an authenticated sprinter.
4. Test photo + signature submission for one `READY_HANDOVER` manifest.
5. Verify Drive evidence files and `MANIFEST` status/URLs.
6. Then implement Phase 8 search/dashboard.
