# AGENTS.md — ECER Working Rules

Single source of truth untuk business requirements: `PRD.md`.
Dokumentasi operasional: `PRODUCT.md`, `DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/ROADMAP.md`.

## 1. Sebelum Coding

1. Baca hanya bagian `PRD.md` dan dokumen `docs/` yang relevan dengan task aktif.
2. Cek `docs/ROADMAP.md` untuk status fase dan scope yang diizinkan.
3. Cek `git status` dan tentukan file target yang spesifik.
4. Implementasikan satu scope terukur per sesi. Jangan membangun seluruh aplikasi sekaligus.

## 2. Efisiensi Context Window

- Jangan melakukan full repository scan berulang; gunakan `docs/ARCHITECTURE.md` sebagai peta repo dan lakukan pencarian terarah.
- Jangan membaca `node_modules/`, `dist/`, `.wrangler/`, file binary, atau generated output.
- Jangan mengulang isi `PRD.md` secara verbatim.
- Ringkas output terminal dan hasil pengujian.

## 3. Aturan Implementasi

- **Arsitektur**: Single-origin Cloudflare Workers + Static Assets (`run_worker_first: ["/api/*"]`), React + Vite + TypeScript strict + Tailwind CSS di `src/`, Hono REST API (`/api/v1/*`) di `worker/`, shared Zod schemas & types di `shared/`.
- **Modularitas**: Jangan membuat folder atau file kosong tanpa tujuan. Buat feature/module hanya saat fase implementasinya dimulai. Jangan menempatkan SQL langsung di route handler.
- **Kualitas kode**: TypeScript `strict: true`, hindari `any`, hindari duplikasi komponen/logika, hindari abstraksi prematur, jangan gunakan `TODO` untuk menggantikan fitur inti.
- **Dependencies**: Evaluasi native Web/Workers API dan dependency yang sudah terpasang sebelum menambah paket baru. Gunakan hanya versi stabil.
- **Desain**: Ikuti `DESIGN.md` (Modern Healthcare Editorial, palet hijau hutan `#123F38` / `#23634E`, Plus Jakarta Sans). Dilarang dominasi ungu, gradient generik AI, glassmorphism berlebihan, atau emoji sebagai ikon utama UI.

## 4. Keamanan & Privasi (Wajib)

- D1 adalah single source of truth; Google Drive hanya penyimpanan PDF/template privat; R2 hanya flyer/aset ringan.
- Jangan menyimpan binary/base64 PDF di D1, jangan membuat file Drive publik, jangan menaruh secret di repo/frontend/log.
- Jangan mencatat PII (NIK, email lengkap, password, PIN, OTP, recovery code, token, secret) di log atau audit log.
- Jangan mematikan validasi keamanan atau melemahkan password KDF agar test lulus atau demi memenuhi batas Workers Free.
- Gunakan data dummy sintetis pada seluruh pengujian; dilarang memakai data peserta asli.

## 5. Setelah Coding

1. Jalankan verifikasi relevan: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
2. Perbarui `docs/ROADMAP.md`, `docs/CHANGELOG.md`, serta `docs/API.md` / `docs/DATABASE.md` / `docs/ARCHITECTURE.md` jika kontrak atau struktur berubah.
3. Laporkan singkat: ringkasan perubahan, file terdampak, hasil pengujian, risiko/blocker, dan langkah berikutnya.

## 6. Batas Persetujuan (Approval Boundaries)

**Boleh tanpa persetujuan ulang**: edit source code lokal, migration lokal, konfigurasi lokal, pengujian lokal.
**Wajib persetujuan pemilik proyek**: deploy production, push ke remote GitHub / `main`, migration production, hapus database/file Drive produksi, kirim email ke peserta asli, aktifkan layanan berbayar, ubah domain produksi, atau ubah keputusan inti `PRD.md` (wajib catat ADR di `docs/decisions/`).
