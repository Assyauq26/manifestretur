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

* **Frontend:** Single-file React (`App.jsx`/`App.tsx`) utilizing `HashRouter` for stable iframe/Canvas compatibility, Tailwind CSS for styling (J&T Red `#D71920`), and Lucide React icons. Libraries include `html5-qrcode` for continuous camera barcode scanning.
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
  * Instant text input validation, duplicate prevention toast alerts, real-time item counter, and item deletion logic.
* **Phase 5: Continuous Camera Barcode Scanner**
  * Integrated `html5-qrcode` engine allowing continuous scanning of barcode resis without closing the camera view, featuring audio/visual feedback (`playBeep`).
* **Phase 6: PDF Generation & Google Drive Storage**
  * Automated backend PDF builder rendering a 4-column AWB grid matching the official J&T template (completely purged of Mandarin text, localized in Indonesian).
  * Automated hierarchical folder management in Google Drive (`MANIFEST_RETUR/PDF/YYYY/MM/DD/`).
  * Custom interactive success modal in the UI providing direct access to open the generated PDF or return to the dashboard.
  * Fixed mobile browser redirect and popup blocking issues.

## 4. Pending / Remaining Phases

* **Phase 7: Hand Over (Penyerahan & Foto Bukti)**
  * *Status:* Not started.
  * *Requirements:* Build the `/handover` view where sprinters view manifests awaiting handover, capture photographic evidence (camera upload), capture digital signatures from the PIC Seller, and update the manifest status in Google Sheets from `READY_HANDOVER` to `COMPLETED`.
* **Phase 8: Retur Dashboard / Search App**
  * *Status:* Not started.
  * *Requirements:* Admin search and filter views for historical manifests and AWB tracking.
* **Phase 9: Polish & Hardening**
  * *Status:* Pending final UI/UX review, error boundary hardening, and production audit logs.

## 5. Instructions for the Next GPT Agent

When taking over this project, note that:
1. The frontend operates inside a **Single-File React structure** (`App.jsx` using `HashRouter`).
2. The backend is an active Google Apps Script web app endpoint (`API_URL` is configured in the code).
3. The next immediate implementation task is **Phase 7 (Hand Over & Evidence Capture)**, which involves building the UI route `/handover`, capturing images/signatures, and updating the manifest status via a new backend API action.
