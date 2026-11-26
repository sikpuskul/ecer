# Panduan Setup GitHub, Cloudflare, dan Google Apps Script — ECER

Dokumen ini merangkum langkah manual yang perlu dilakukan pemilik proyek pada **GitHub**, **Cloudflare**, dan **Google Apps Script** untuk mendukung pengembangan, staging technical gate (Phase 1), dan kesiapan rilis.

---

## 1. Setup Repository GitHub (Private)

1. Buat repository **Private** baru di GitHub (misalnya `ecer` atau `ecer-pkm-smk`). Jangan inisialisasi dengan README/gitignore baru agar tidak konflik dengan repo lokal.
2. Aktifkan branch utama `main` dan branch integrasi `dev`:
   - Lindungi branch `main` (_Branch Protection Rules_): wajib Pull Request, larang force push, larang penghapusan branch.
3. Hubungkan repo lokal (setelah Anda meninjau commit awal dan menyetujui push):
   ```bash
   git add .
   git commit -m "chore: phase 0 foundation and phase 1 security integration"
   git branch -M main
   git remote add origin https://github.com/<username-atau-org>/<nama-repo>.git
   git push -u origin main
   git checkout -b dev
   git push -u origin dev
   ```
4. **Secret Scanning**: Aktifkan _Secret scanning_ & _Push protection_ di GitHub Settings → Code security agar secret tidak pernah lolos ke commit.

---

## 2. Setup Cloudflare (Staging & Persiapan)

> **Catatan**: Pada Phase 1, cukup siapkan resource **staging** terlebih dahulu (belum perlu production).

1. **Login Wrangler lokal**:
   ```bash
   npx wrangler login
   ```
2. **Buat Cloudflare D1 Staging**:
   ```bash
   npx wrangler d1 create ecer-staging
   ```
   Simpan `database_id` yang muncul untuk konfigurasi environment staging (jangan ubah database lokal `ecer-local`).
3. **Buat Cloudflare R2 Staging**:
   - Buka Cloudflare Dashboard → **R2 Object Storage** (Cloudflare meminta metode pembayaran terdaftar meskipun pemakaian tetap dalam kuota gratis 10 GB/bulan).
   - Buat bucket `ecer-flyers-staging` (biarkan **Private**, jangan aktifkan Public Development URL / public bucket).
4. **Buat Cloudflare Turnstile Widget (Staging)**:
   - Buka Cloudflare Dashboard → **Turnstile** → Add widget.
   - Tambahkan hostname staging (mis. `*.workers.dev` atau subdomain staging Anda).
   - Catat **Site Key** (`TURNSTILE_SITE_KEY`) dan **Secret Key** (`TURNSTILE_SECRET_KEY`).
   - Untuk lokal (`localhost`), tetap gunakan official test key Cloudflare yang sudah ada di `.dev.vars.example`.
5. **Siapkan Secrets untuk Staging** (saat akan uji staging Workers):
   Generate kunci acak 32-byte base64 (`DATA_ENCRYPTION_KEY`, `LOOKUP_HMAC_KEY`, `GAS_SHARED_SECRET`), lalu set melalui:
   ```bash
   npx wrangler secret put GAS_SHARED_SECRET
   npx wrangler secret put DATA_ENCRYPTION_KEY
   npx wrangler secret put LOOKUP_HMAC_KEY
   npx wrangler secret put TURNSTILE_SECRET_KEY
   ```

---

## 3. Setup Google Drive & Google Apps Script (Staging Technical Gate)

1. Gunakan akun Google khusus aplikasi (bukan akun pribadi campuran).
2. Buat struktur folder **Private / Restricted** di Google Drive:
   ```text
   ECER/
   └── staging/
       ├── templates/
       │   └── snapshots/
       ├── certificates/
       ├── awards/
       └── temporary/
   ```
   Catat Folder ID untuk `ECER` (root), `snapshots`, dan `temporary`.
3. Buka [script.google.com](https://script.google.com) → **New Project** (nama: `ECER Staging Engine`), lalu salin berkas dari folder `apps-script/` (atau push menggunakan `clasp`).
4. Buka **Project Settings → Script Properties**, lalu tambahkan:
   - `GAS_SHARED_SECRET` (nilai yang sama persis dengan Worker secret staging)
   - `APP_ENV` = `staging`
   - `APP_BASE_URL` = URL staging Worker Anda
   - `DRIVE_ROOT_FOLDER_ID` = ID folder `ECER`
   - `TEMPLATE_SNAPSHOT_FOLDER_ID` = ID folder `staging/templates/snapshots`
   - `TEMP_FOLDER_ID` = ID folder `staging/temporary`
5. **Deploy → New Deployment → Web App**:
   - _Execute as_: **Me** (akun khusus aplikasi)
   - _Who has access_: **Anyone** _(wajib untuk komunikasi server-to-server Worker → Apps Script; seluruh action dilindungi signature HMAC-SHA256 + anti-replay nonce di `Auth.gs`)_.
   - Salin Web App URL (`https://script.google.com/macros/s/.../exec`) ke `GAS_WEB_APP_URL`.
