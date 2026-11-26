# Changelog — ECER

Seluruh perubahan penting pada proyek ECER dicatat pada berkas ini.

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
