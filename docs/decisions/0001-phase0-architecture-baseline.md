# ADR-0001: Baseline Arsitektur Phase 0 (Single-Origin Workers + Static Assets)

- **Tanggal**: 2026-11-26
- **Status**: Accepted
- **Konteks**: Phase 0 Project Foundation untuk ECER berdasarkan `PRD.md` v1.0.0.

## Keputusan

1. **Cloudflare Workers + Static Assets via `@cloudflare/vite-plugin`**
   - Menggunakan `@cloudflare/vite-plugin` dengan `wrangler.jsonc` (`not_found_handling: "single-page-application"` dan `run_worker_first: ["/api/*"]`).
   - Alasan: Sesuai rekomendasi resmi Cloudflare dan PRD §3.5, memberikan satu dev server lokal terpadu untuk React + Hono, memastikan static assets dilayani langsung dari edge tanpa memakan kuota invocation Worker, dan mencegah SPA fallback mengintersepsi `/api/v1/*`.
2. **Tailwind CSS v4 dengan CSS-first Semantic Tokens**
   - Mendefinisikan palet _Modern Healthcare Editorial_ sebagai CSS custom properties di `src/styles/tokens.css` dan memetakannya ke `@theme` di `src/styles/index.css`.
   - Alasan: Satu sumber kebenaran token visual yang selaras dengan `DESIGN.md`, minim konfigurasi boilerplate, dan ukuran CSS produksi sangat kecil.
3. **Minimal Dependencies di Phase 0**
   - Hanya memasang paket inti yang dibutuhkan Phase 0 (`react`, `react-dom`, `hono`, `zod`, `lucide-react`, `vite`, `@vitejs/plugin-react`, `@cloudflare/vite-plugin`, `tailwindcss`, `@tailwindcss/vite`, `typescript`, `wrangler`, `vitest`, `eslint`, `prettier`).
   - Paket fitur lanjutan (`react-router`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `playwright`, dll.) akan dipasang tepat pada fase yang membutuhkannya agar bundle dan dependency tree tetap ramping.
4. **Tidak Membuat Folder Kosong atau Binding Produksi di Phase 0**
   - Folder modul bisnis (`src/features/*`, `worker/modules/*`, `migrations/`, `apps-script/`) dan binding D1/R2 belum diaktifkan sebelum Phase 1.
   - Alasan: Mematuhi aturan anti-empty-folder dan mencegah konfigurasi placeholder database/bucket yang menyesatkan.

## Trade-off & Konsekuensi

- **Biaya**: 100% kompatibel dengan Cloudflare Workers Free Tier pada Phase 0.
- **Keamanan**: Security headers baseline dan envelope error tanpa stack trace aktif sejak hari pertama.
- **Tindak lanjut (Phase 1 Technical Gate)**: Benchmark KDF (PBKDF2/Argon2id), benchmark transfer PDF base64 hingga 2 MiB, serta verifikasi kuota `MailApp` wajib menjadi gerbang kelayakan sebelum membangun modul bisnis.
