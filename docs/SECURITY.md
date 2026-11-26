# Arsitektur Keamanan & Privasi — ECER

Dokumen ini merangkum kontrol keamanan dan privasi yang wajib dipenuhi ECER sesuai `PRD.md` §25–27.

## 1. Autentikasi Administrator (Phase 1)

- **Mekanisme**: Username + password dengan server-side session token acak (opaque token) tersimpan di D1 sebagai hash (`admin_sessions.token_hash`). Tidak menggunakan JWT.
- **Cookie session**: `HttpOnly`, `Secure` (HTTPS), `SameSite=Lax` (atau `Strict`), `Path=/`, dan prefix `__Host-` di production.
- **Masa berlaku**: Idle timeout 30 menit, absolute timeout 12 jam, pencabutan server-side saat logout atau reset password.
- **Password KDF**: Salt unik per admin menggunakan PBKDF2-HMAC-SHA256 atau Argon2id yang dibenchmark pada Phase 1. **Dilarang** menggunakan SHA-256 polos dan **dilarang** melemahkan KDF demi batas CPU Workers Free.
- **Bootstrap**: Admin awal dibuat via script/CLI aman; tidak ada default password di repository.

## 2. Perlindungan Request & Headers

- **Security Headers (Aktif sejak Phase 0)**:
  - `Content-Security-Policy` ketat (akan diperluas secara terukur pada Phase 1/5 untuk Cloudflare Turnstile & PDF preview tanpa wildcard berlebih).
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - `Permissions-Policy` minimal
  - `Strict-Transport-Security` di production (HTTPS)
  - `X-Frame-Options: DENY` / `frame-ancestors 'none'` pada rute umum (disesuaikan untuk inline PDF preview terotorisasi pada Phase 7)
- **CSRF & CORS**: Default same-origin; validasi `Origin` pada mutasi terautentikasi; larangan wildcard credentials.
- **Turnstile & Rate Limiting (Phase 1 & 5)**: Turnstile wajib diverifikasi di backend untuk login admin, registrasi peserta, pencarian/recovery, dan permintaan OTP. Rate limiting menggabungkan IP, lookup key hash, event ID, dan session agar aman pada skenario WiFi puskesmas (shared public IP).

## 3. Privasi Data & Enkripsi (Phase 1 & 5)

- **Minimalisasi data**: Jangan meminta NIK jika nomor peserta atau kode registrasi mencukupi.
- **Pemisahan kunci rahasia (Worker Secrets)**:
  - `DATA_ENCRYPTION_KEY`: AES-GCM dengan random IV unik per record untuk PII terenkripsi (dilengkapi metadata versi kunci untuk rotasi).
  - `LOOKUP_HMAC_KEY`: Keyed HMAC-SHA256 untuk exact-match unique/search/whitelist key (mencegah brute-force terhadap ruang nilai NIK).
  - `GAS_SHARED_SECRET`: HMAC-SHA256 signing untuk komunikasi Worker ↔ Google Apps Script.
- **Anti-enumerasi**: Response registrasi duplikat, pencarian sertifikat, dan pengiriman OTP wajib generik agar tidak membocorkan keberadaan NIK/email peserta.
- **Akses PDF privat**: File PDF di Google Drive bersifat restricted. Peserta hanya bisa mengunduh melalui Worker setelah lolos verifikasi (search key + recovery code atau email OTP) dan memiliki temporary `download_grants` (TTL 10 menit, cookie `HttpOnly`).

## 4. Keamanan Integrasi Google Apps Script (Phase 1)

- Komunikasi hanya melalui `doPost(e)` dengan action allowlist (`health`, `inspect_template`, `snapshot_template`, `generate_document`, `get_generation_result`, `fetch_pdf`, `send_email`, `get_email_quota`, `delete_managed_file`).
- Envelope JSON ditandatangani HMAC-SHA256 pada body (`version + timestamp + nonce + action + payload_hash`), toleransi timestamp 5 menit, dan anti-replay berbasis `nonce` pada kedua sisi.
- Apps Script tidak pernah mengeksekusi kode arbitrer dan tidak melayani file Drive di luar folder terkelola aplikasi.

## 5. Kebijakan Logging & Larangan

Dilarang keras mencatat data berikut ke console, Worker logs, Apps Script logs, maupun `audit_logs`:

- Raw request body berisi PII, NIK, email lengkap, nomor telepon, alamat.
- Password, hash password, PIN kegiatan, OTP, recovery code, session token, download grant token.
- `GAS_SHARED_SECRET`, `DATA_ENCRYPTION_KEY`, `LOOKUP_HMAC_KEY`, `TURNSTILE_SECRET_KEY`.
- Payload PDF base64.

Gunakan `requestId` dan kategori error yang aman untuk pelacakan operasional.
