# Roadmap Implementasi — ECER

Pelacak progres resmi berdasarkan `PRD.md` §38. Setiap fase dijalankan secara bertahap dengan persetujuan pemilik proyek sebelum berpindah ke fase berikutnya.

## Ringkasan Status

| Fase         | Nama                                                         | Status                                                   |
| ------------ | ------------------------------------------------------------ | -------------------------------------------------------- |
| **Phase 0**  | Project Foundation                                           | Selesai                                                  |
| **Phase 1**  | Security & Google Integration Feasibility _(Technical Gate)_ | Selesai (lolos uji live staging Workers Free + D1 + GAS) |
| **Phase 2**  | Database & Core Admin                                        | Selesai                                                  |
| **Phase 3**  | Event Management                                             | Selesai                                                  |
| **Phase 4**  | Templates & Dynamic Forms                                    | Selesai                                                  |
| **Phase 5**  | Public Interface & Participants                              | Selesai                                                  |
| **Phase 6**  | Document Generation                                          | Selesai                                                  |
| **Phase 7**  | PDF Delivery & Recovery                                      | Selesai                                                  |
| **Phase 8**  | Email Delivery                                               | Selesai                                                  |
| **Phase 9**  | Awards (Piagam)                                              | Selesai                                                  |
| **Phase 10** | Reports & Operations                                         | Selesai                                                  |
| **Phase 11** | Quality Assurance                                            | Selesai                                                  |
| **Phase 12** | Staging & Production Release                                 | Menunggu persetujuan                                     |

---

## Phase 0 — Project Foundation _(Selesai)_

- [x] Analisis `PRD.md`, verifikasi kompatibilitas Cloudflare Workers Free / D1 / R2 / Google Apps Script, dan identifikasi risiko teknis
- [x] Struktur proyek modular tanpa folder kosong dan tanpa business modules prematur
- [x] Dokumen kerja & arsitektur: `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, `README.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/ROADMAP.md`, `docs/CHANGELOG.md`, ADR `0001`
- [x] Inisialisasi React + Vite + TypeScript (strict) + Tailwind CSS + Hono + Cloudflare Workers + Static Assets (`@cloudflare/vite-plugin` & `wrangler.jsonc`)
- [x] Konfigurasi shared schemas (`shared/`), environment examples (`.env.example`, `.dev.vars.example`), ESLint, Prettier, Vitest, dan `.gitignore`
- [x] Health check backend (`GET /api/v1/health`) dan tampilan health check frontend dengan fondasi design system _Modern Healthcare Editorial_
- [x] Verifikasi `typecheck`, `lint`, `test`, dan `build`

---

## Phase 1 — Security & Google Integration Feasibility _(Technical Gate)_

**Tujuan**: Membuktikan kelayakan keamanan dan integrasi Google dalam batas target runtime sebelum membangun business modules.

- [x] Setup binding lokal Cloudflare D1 (`DB`) dan R2 (`FLYER_BUCKET`) di `wrangler.jsonc` serta migration awal `migrations/0001_phase1_security_foundation.sql`
- [x] Implementasi autentikasi sesi admin server-side (`POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password`, cookie `HttpOnly`, idle 30m / absolute 12h, CSRF Origin check, Turnstile verification, dan CLI `scripts/bootstrap-admin.mjs`)
- [x] Implementasi helper kriptografi inti (PBKDF2-HMAC-SHA256 100k, AES-GCM + key version metadata, keyed HMAC lookup, opaque token) dan skrip benchmark `scripts/benchmark-phase1.mjs`
- [x] Implementasi adapter Worker ↔ Google Apps Script (`worker/integrations/google-apps-script/`) dengan canonical HMAC-SHA256 signing, allowlisted 302 redirect handling, PDF `%PDF-` & batas 2 MiB, serta penanganan timeout/retry aman
- [x] Scaffold modular `apps-script/` (`Main.gs`, `Auth.gs`, `Response.gs`, `Config.gs`, `Utils.gs`, `DriveService.gs`, `TemplateService.gs`, `PlaceholderService.gs`, `QrService.gs`, `JobRegistry.gs`, `DocumentService.gs`, `EmailService.gs`)
- [x] Unit & integration tests untuk kriptografi, auth/CSRF/session expiry, serta mock integrasi Apps Script (`tests/unit/security.test.ts`, `tests/unit/gas-integration.test.ts`, `tests/integration/auth.test.ts`)
- [x] Panduan setup GitHub, Cloudflare Staging, dan Google Apps Script di `docs/DEPLOYMENT.md`
- [x] _(Live Staging Gate)_ Lolos uji live di `https://ecer-staging.siksumakul.workers.dev`: PBKDF2 100k login + `__Host-ecer_session` cookie + signed HMAC-SHA256 Worker → Google Apps Script (`health`, `remainingEmailQuota: 100`)

---

## Phase 2–12 (Ringkasan Backlog)

- **Phase 2**: SQL migrations lengkap (`migrations/`), ERD Mermaid di `docs/DATABASE.md`, Admin layout & dashboard shell, manajemen admin, pengaturan aplikasi, kategori kegiatan, audit log.
- **Phase 3**: Event CRUD, editor 7 tab, upload flyer ke R2, lifecycle & periode, kuota, duplikasi kegiatan, validasi publikasi.
- **Phase 4**: Import template Google Docs, ekstraksi placeholder, snapshot versioning, placeholder mapping, dynamic form builder, form versioning, test generation.
- **Phase 5**: Dashboard publik (navigasi bulan/tahun, statistik bulanan, filter & kartu kegiatan), dynamic form renderer mobile-first, PIN kehadiran, whitelist, duplicate prevention, kuota atomik, manual approval.
- **Phase 6**: Numbering engine atomik, tabel `documents` & `document_revisions`, durable `generation_jobs`, Cron recovery processor, QR Code, idempotency, regenerasi, pencabutan.
- **Phase 7**: Recovery code, email OTP, otorisasi pencarian anti-enumerasi, `download_grants`, preview & unduh PDF privat, halaman verifikasi publik (`/verifikasi/:code`).
- **Phase 8**: Template email, lampiran PDF, antrean `email_jobs`, manajemen kuota `deferred_quota`, retry & manual resend, monitor email admin.
- **Phase 9**: Penerbitan piagam manual, bulk import CSV/XLSX (maks 100 baris/batch, anti formula injection), import dari peserta, kategori penghargaan, verifikasi piagam.
- **Phase 10**: Laporan & statistik admin, chart ringan (lazy-loaded khusus admin), export CSV/XLSX aman, monitoring job, konfigurasi retensi & dry-run cleanup, dokumentasi backup/recovery (`docs/OPERATIONS.md`, `docs/DEPLOYMENT.md`).
- **Phase 11**: Responsive audit (`320px–1920px`), Impeccable UI review, audit aksesibilitas WCAG 2.2 AA, audit performa React, security testing, load testing staging.
- **Phase 12**: CI GitHub Actions, staging deployment & acceptance testing, serta persiapan production deployment (memerlukan persetujuan eksplisit pemilik proyek).
