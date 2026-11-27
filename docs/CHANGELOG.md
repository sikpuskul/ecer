# Changelog — ECER

Seluruh perubahan penting pada proyek ECER dicatat pada berkas ini.

## [0.12.0] - 2026-11-27 (Phase 11: Quality Assurance)

### Changed & Improved

- **Aksesibilitas WCAG 2.2 AA & Responsivitas**: menambahkan skip-to-content link (`Lewati ke konten utama`), `id="main-content"`, target sentuh `min-h-[44px]` pada `src/layouts/PublicLayout.tsx`, serta `overflow-x: clip` pada `src/styles/index.css`.
- **Optimasi Bundle Publik**: menerapkan lazy-loading pada rute `PublicRegisterPage`, `PublicSearchPage`, dan `PublicVerifyPage` di `src/app/router.tsx` serta menghapus file legacy Phase 0 yang tidak terpakai (`src/features/public-home/PublicHomePage.tsx`).
- **Automated Security QA Matrix**: menambahkan `tests/unit/security-qa.test.ts` yang memverifikasi 16 endpoint admin terproteksi (`401`), header keamanan ketat + HSTS, serta penolakan CSRF Origin (`403`).
- **Dokumentasi QA**: menambahkan laporan audit lengkap pada `docs/QA_REPORT.md`.

## [0.11.0] - 2026-11-27 (Phase 10: Reports & Operations)

### Added

- Shared report & retention schemas + safe CSV exporter (`shared/schemas/reports.ts`, `shared/utils/csv-export.ts`): UTF-8 BOM, RFC-4180 escaping, dan mitigasi CSV formula injection (`'`).
- Backend Reports & Retention Module (`worker/modules/reports/`): agregasi tahunan (`GET /api/v1/admin/reports/overview`), ekspor CSV aman (`GET /api/v1/admin/reports/export.csv`), dry-run retensi (`GET /api/v1/admin/reports/retention/dry-run`), dan pembersihan token/sesi kedaluwarsa (`POST /api/v1/admin/reports/retention/cleanup`) lengkap dengan audit log.
- Admin UI Laporan & Retensi (`src/features/reports/pages/AdminReportsPage.tsx`, rute `/admin/laporan` lazy-loaded): 4 kartu KPI, grafik batang tren bulanan ringan (tanpa library chart eksternal), ringkasan kategori, daftar kegiatan, ekspor CSV, dan panel dry-run retensi.
- Runbook operasional, backup D1 Time Travel, rotasi secret, dan respons insiden pada `docs/OPERATIONS.md`.
- Unit & security test `tests/unit/reports-operations.test.ts`.

## [0.10.0] - 2026-11-27 (Phase 9: Awards / Piagam)

### Added

- Shared schemas & safe CSV parser untuk piagam (`shared/schemas/awards.ts`, `shared/utils/csv-awards.ts`): batas maksimal 100 baris/batch, deteksi delimiter koma/titik koma, serta sanitasi anti formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`).
- Backend Awards Module (`worker/modules/awards/`): penerbitan piagam manual (`POST /api/v1/admin/awards`), bulk import (`POST /api/v1/admin/awards/bulk-import`), import idempoten dari peserta terdaftar (`POST /api/v1/admin/awards/import-participants`), daftar template piagam terhubung, dan daftar piagam terbit khusus admin (terpisah dari pencarian publik & statistik sertifikat bulanan).
- Admin UI Manajemen Piagam (`src/features/awards/pages/AdminAwardsPage.tsx`, rute `/admin/piagam` lazy-loaded): 3 mode penerbitan (Manual, Import CSV dengan pratinjau validasi, Import dari Peserta), daftar piagam terbit lengkap dengan tautan verifikasi QR, unduh PDF, kirim email, regenerate, dan cabut.
- Unit & security test `tests/unit/awards.test.ts`.

## [0.9.0] - 2026-11-27 (Phase 8: Email Delivery)

### Added

- Shared email schemas & pure template renderer (`shared/schemas/email.ts`, `shared/utils/email-template.ts`): rendering placeholder email (`{{nama_lengkap}}`, `{{nama_kegiatan}}`, `{{nomor_dokumen}}`, `{{tanggal_kegiatan}}`, `{{penyelenggara}}`, `{{link_verifikasi}}`), sanitasi CRLF subjek email, masking email penerima, dan kalkulasi reset kuota `Asia/Jakarta`.
- Durable Email Delivery Engine (`worker/modules/email/`): antrean idempoten `email_jobs` dengan atomic lease claim, dukungan embargo `email_release_at` & `embargoUntilDownloadStart`, penanganan otomatis kuota harian `MailApp` (`deferred_quota` dengan penjadwalan ulang otomatis di 00:10 WIB), backoff retry, serta manual resend oleh admin.
- Integrasi otomatis pemicu email setelah penerbitan PDF sukses (`worker/modules/documents/service.ts`), pengiriman OTP email recovery aktual (`worker/modules/recovery/routes.ts`), dukungan email tanpa lampiran pada `apps-script/EmailService.gs`, dan pemrosesan batch antrean email pada Cron `scheduled` (`worker/index.ts`).
- Admin UI Monitor Email (`src/features/email/pages/AdminEmailPage.tsx`, rute `/admin/email`) lengkap dengan indikator sisa kuota `MailApp`, filter status, aksi retry/batalkan, serta tombol **Kirim Email** pada `/admin/sertifikat`.
- Unit & security test `tests/unit/email-delivery.test.ts`.

## [0.8.0] - 2026-11-27 (Phase 7: PDF Delivery, Recovery & QR Verification)

### Added

- Utilitas masking nama penerima (`shared/utils/masking.ts`) dan shared schemas recovery/verifikasi (`shared/schemas/recovery.ts`).
- Public Recovery & Private PDF Proxy API (`worker/modules/recovery/routes.ts`): pencarian anti-enumerasi (`POST /public/events/:slug/search`), verifikasi recovery code / OTP email (`POST /public/recovery/verify`), pengiriman ulang OTP dengan cooldown 60 detik & batas 5 percobaan (`POST /public/recovery/resend`), penerbitan temporary `download_grants` via cookie `HttpOnly` (`__Host-ecer_grant`, TTL 10 menit), serta proxy PDF privat dari Google Drive (`preview` & `download` dengan `Cache-Control: private, no-store` dan `X-Content-Type-Options: nosniff`).
- Public QR Verification API (`worker/modules/verification/routes.ts`): `GET /public/verify/:verificationCode` dengan status `VALID` / `REVOKED` / `NOT_FOUND` / `UNAVAILABLE`, masking nama sesuai pengaturan aplikasi, dan header `X-Robots-Tag: noindex, nofollow`.
- Admin PDF Download API (`GET /api/v1/admin/documents/:id/download`) dan tombol **Unduh PDF** pada halaman `/admin/sertifikat`.
- Antarmuka Publik: halaman `/kegiatan/:slug/cari` (`PublicSearchPage`), halaman `/verifikasi/:verificationCode` (`PublicVerifyPage` dengan `<meta name="robots" content="noindex, nofollow">` dan disclaimer non-BSrE), serta tombol **Cari Sertifikat** pada kartu kegiatan di beranda (`/`).
- Unit & security test `tests/unit/recovery-verify.test.ts`.

## [0.7.0] - 2026-11-27 (Phase 6: Document Generation)

### Added

- Atomic Document Numbering Engine (`shared/schemas/numbering.ts`, `shared/utils/numbering.ts`, `worker/modules/numbering/`): token lengkap (`{SEQ}`, `{EVENT_CODE}`, `{DOC_TYPE}`, `{MONTH}`, `{MONTH_ROMAN}`, `{YEAR}`, `{ORG_CODE}`), strategi reset (`never`, `monthly`, `yearly`, `per_event`), dan increment atomik `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`.
- Local QR Code PNG Encoder (`worker/utils/qr-png.ts` berbasis `uqr` + native `CompressionStream('deflate')`) tanpa layanan QR eksternal.
- Document Issuance, Durable Generation Jobs, Regeneration, Revocation & Cron Recovery (`worker/modules/documents/`, `worker/index.ts` `scheduled` handler): conditional atomic job claim dengan lease 2 menit, backoff retry, idempotency, regenerasi revisi (nomor & kode verifikasi tetap), serta pencabutan dokumen & download grants.
- Frontend Admin UI: `/admin/penomoran`, `/admin/sertifikat`, dan `/admin/jobs` (lazy-loaded).
- Unit test `tests/unit/numbering-qr.test.ts`.

## [0.6.0] - 2026-11-27 (Phase 5: Public Interface & Participants)

### Added

- Utilitas kalender `Asia/Jakarta` (`shared/utils/jakarta-date.ts`) dengan navigasi bulan/tahun lintas tahun (Des → Jan) dan konversi rentang bulan ke UTC.
- Public REST API (`worker/modules/public/routes.ts`): `/public/dashboard`, `/public/events`, `/public/events/:slug`, `/public/events/:slug/form`, dan `POST /public/events/:slug/register` lengkap dengan penegakan periode server-side, Turnstile, PIN/Whitelist, enkripsi AES-GCM PII, keyed HMAC duplicate prevention anti-enumerasi, kuota, dan 128-bit recovery code.
- Admin Participants & Whitelist API (`worker/modules/participants/`): daftar peserta terdekripsi, approve/reject/cancel, dan manajemen whitelist kehadiran.
- Antarmuka Publik (_Modern Healthcare Editorial_, mobile-first dari 320px): `PublicLayout`, `PublicDashboardPage` (`/`), `PublicRegisterPage` (`/kegiatan/:slug/daftar`), serta `AdminParticipantsPage` (`/admin/kegiatan/:id/peserta`).
- Unit test `tests/unit/jakarta-date.test.ts`.

## [0.5.0] - 2026-11-27 (Phase 4: Templates & Dynamic Forms)

### Added

- Shared template & dynamic form schemas + validator (`shared/schemas/templates.ts`, `shared/schemas/forms.ts`, `shared/utils/form-validator.ts`) dengan validasi ketat URL Google Docs, NIK 16-digit string, allowlist opsi, dan proteksi ReDoS.
- Backend Google Docs Templates (`worker/modules/templates/`): import & ekstraksi placeholder via signed Apps Script, mapping placeholder, refresh versi baru, validasi + snapshot privat Google Docs, test generation PDF dummy tanpa nomor produksi, dan proteksi penghapusan template terpakai.
- Backend Dynamic Forms & Event-Template Linking (`worker/modules/forms/`): versioning non-destruktif (`draft` → `published`), validasi regex aman, serta penautan template kegiatan.
- Frontend Templates & Form Builder (`src/features/templates/`, `src/features/form-builder/`): `/admin/template`, `/admin/template/:id`, dan `/admin/kegiatan/:id/formulir` lengkap dengan preview formulir mobile-first.
- Unit test `tests/unit/templates-forms.test.ts`.

## [0.4.0] - 2026-11-27 (Phase 3: Event Management)

### Added

- Shared event schemas & pure real-time status/eligibility engine (`shared/schemas/events.ts`, `shared/utils/event-status.ts`) mengikuti aturan interval `start_at <= now < end_at` dan override penutupan manual.
- Backend Event Management (`worker/modules/events/`): CRUD kegiatan, hashing PIN kehadiran, validasi checklist sebelum publikasi, lifecycle (`publish`, `close`, `reopen`, `archive`), duplikasi aman (selalu draft tanpa menyalin PIN/peserta/dokumen), serta pembatasan hapus khusus draft kosong.
- Backend Flyer Storage Cloudflare R2 (`worker/modules/storage/routes.ts`): upload JPEG/PNG/WebP maks 5 MiB dengan validasi magic bytes (menolak SVG), cleanup flyer terganti, dan proteksi flyer draft agar tidak bisa diakses publik.
- Frontend Event Management (`src/features/events/`): halaman daftar kegiatan `/admin/kegiatan` (pencarian, filter kategori/status, kartu 16:9, duplikasi & hapus draft) dan editor bertab 5 bagian `/admin/kegiatan/baru` & `/admin/kegiatan/:id/edit` (unsaved changes warning, upload flyer, checklist publikasi, kontrol lifecycle).
- Unit test `tests/unit/event-status.test.ts`.

## [0.3.0] - 2026-11-27 (Phase 2: Database & Core Admin)

### Added

- SQL migration lengkap `migrations/0002_core_business_schema.sql` (17 tabel bisnis inti + seed 9 `event_categories` awal + default non-secret `app_settings` + seluruh indeks wajib) dan ERD Mermaid aktual pada `docs/DATABASE.md`.
- Backend Core Admin REST API (`/api/v1/admin/dashboard`, `/admin/users`, `/admin/settings`, `/admin/categories`, `/admin/audit-logs`, `/admin/integration/gas-health`) lengkap dengan otorisasi sesi admin, proteksi CSRF Origin, pencegahan penonaktifan admin aktif terakhir, dan pencatatan audit log.
- Frontend routing (`react-router`) & server state (`@tanstack/react-query`) dengan lazy-loading untuk seluruh rute `/admin/*`.
- UI Core Admin (_Modern Healthcare Editorial_): `/admin/login` (dengan integrasi Cloudflare Turnstile), `AdminLayout` responsif (collapsible sidebar + mobile drawer), `/admin`, `/admin/pengguna`, `/admin/pengaturan`, dan `/admin/audit-log`.
- Integration test `tests/integration/core-admin.test.ts`.

## [0.2.0] - 2026-11-26 (Phase 1: Security & Google Integration Feasibility)

### Added

- Binding lokal Cloudflare D1 (`DB`) dan R2 (`FLYER_BUCKET`) pada `wrangler.jsonc` serta migration awal `migrations/0001_phase1_security_foundation.sql` (`admins`, `admin_sessions`, `integration_replays`, `audit_logs`).
- Modul keamanan `worker/security/` (`crypto.ts`, `password.ts`, `turnstile.ts`) dan middleware `worker/middleware/` (`csrf.ts`, `auth.ts`).
- Modul autentikasi admin `worker/modules/auth/` (`/api/v1/auth/login`, `/logout`, `/me`, `/change-password`) dan shared schema `shared/schemas/auth.ts`.
- Skrip CLI `scripts/bootstrap-admin.mjs` (tanpa default password di repo) dan `scripts/benchmark-phase1.mjs`.
- Adapter integrasi bertanda tangan HMAC-SHA256 `worker/integrations/google-apps-script/` (`types.ts`, `schemas.ts`, `signing.ts`, `client.ts`) dengan allowlisted redirect handling dan validasi PDF 2 MiB.
- Scaffold modular `apps-script/` (12 berkas `.gs` + `appsscript.json` + `.claspignore`).
- Unit & integration tests (`tests/unit/security.test.ts`, `tests/unit/gas-integration.test.ts`, `tests/integration/auth.test.ts`).
- Panduan setup GitHub, Cloudflare Staging, dan Google Apps Script pada `docs/DEPLOYMENT.md`.

## [0.1.0] - 2026-11-26 (Phase 0: Project Foundation)

### Added

- Dokumentasi fondasi proyek: `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, `README.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/ROADMAP.md`, dan ADR `docs/decisions/0001-phase0-architecture-baseline.md`.
- Konfigurasi full-stack single-origin: React 19, Vite, TypeScript (strict), Tailwind CSS v4, Hono, dan Cloudflare Workers + Static Assets (`@cloudflare/vite-plugin`, `wrangler.jsonc`).
- Fondasi design tokens _Modern Healthcare Editorial_ pada `src/styles/tokens.css` dan `src/styles/index.css`.
- Kontrak bersama `shared/constants/api.ts` dan `shared/schemas/health.ts` menggunakan Zod.
- Middleware dasar backend (`request-id`, `security-headers`, `error-handler`) dan endpoint `GET /api/v1/health`.
- Halaman health check frontend (`src/app/App.tsx`) dan API client (`src/lib/api-client.ts`).
- Konfigurasi kualitas kode & pengujian: ESLint, Prettier, Vitest, `.env.example`, `.dev.vars.example`, dan `.gitignore`.
- Unit test dasar untuk schema bersama dan endpoint health backend.
