# ECER — Sertifikat dan Piagam Digital

Aplikasi web pengelolaan, penerbitan, distribusi, pencarian, pengunduhan, dan verifikasi sertifikat serta piagam penghargaan digital untuk **Puskesmas Sumbermanjing Kulon**.

## Status Proyek

Saat ini berada pada **Phase 0: Project Foundation**. Business modules belum diimplementasikan. Lihat [docs/ROADMAP.md](docs/ROADMAP.md) untuk rencana bertahap dan status progres.

## Teknologi Utama

- **Frontend**: React, TypeScript (strict), Vite, Tailwind CSS, Zod
- **Backend**: Cloudflare Workers + Static Assets, Hono (`/api/v1/*`), Zod
- **Penyimpanan & Layanan (Phase 1+)**: Cloudflare D1, Cloudflare R2, Cloudflare Turnstile, Google Apps Script (Google Docs, Drive privat, MailApp)
- **Kualitas & Pengujian**: ESLint, Prettier, Vitest

## Struktur Dokumentasi

- `PRD.md` — Single source of truth kebutuhan produk
- `AGENTS.md` — Aturan kerja AI agent dan engineering guardrails
- `PRODUCT.md` — Konteks produk dan batasan operasional
- `DESIGN.md` — Fondasi design system (_Modern Healthcare Editorial_)
- `docs/ARCHITECTURE.md` — Peta arsitektur, struktur repo, dan analisis risiko teknis
- `docs/DATABASE.md` — Rancangan skema Cloudflare D1 dan konvensi migrasi
- `docs/API.md` — Spesifikasi REST API `/api/v1` dan kontrak respons
- `docs/SECURITY.md` — Model keamanan, enkripsi, autentikasi, dan privasi
- `docs/ROADMAP.md` — Pelacak progres Phase 0 hingga Phase 12
- `docs/CHANGELOG.md` — Catatan perubahan proyek
- `docs/decisions/` — Architecture Decision Records (ADR)

## Pengembangan Lokal

1. Salin berkas contoh environment:
   ```bash
   cp .env.example .env
   cp .dev.vars.example .dev.vars
   ```
2. Pasang dependency:
   ```bash
   npm install
   ```
3. Jalankan server lokal (Frontend + Worker terpadu melalui `@cloudflare/vite-plugin`):
   ```bash
   npm run dev
   ```
4. Verifikasi kualitas kode:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   npm run build
   ```

## Endpoint Health Check (Phase 0)

- Backend API: `GET /api/v1/health`
- Frontend: `/` (menampilkan status fondasi aplikasi dan hasil pengecekan koneksi backend)
