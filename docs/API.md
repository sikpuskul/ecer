# Spesifikasi REST API — ECER

Base path untuk seluruh endpoint backend adalah `/api/v1`.
Seluruh request `/api/*` diarahkan langsung ke Cloudflare Worker (`run_worker_first: ["/api/*"]`) dan tidak boleh diintersepsi oleh SPA fallback.

## 1. Format Response Standar

### Sukses

```json
{
  "success": true,
  "data": {},
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Paginasi (default `limit=20`, maks `100`)

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Permintaan tidak valid."
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

> Stack trace, detail query SQL, secret, dan Google Drive file ID tidak pernah dikembalikan dalam response API publik.

## 2. HTTP Status Codes

| Status | Penggunaan                                              |
| ------ | ------------------------------------------------------- |
| `200`  | Operasi berhasil                                        |
| `201`  | Resource baru berhasil dibuat                           |
| `202`  | Generation/email job diterima untuk diproses asinkron   |
| `400`  | Request tidak valid                                     |
| `401`  | Autentikasi diperlukan / sesi tidak valid               |
| `403`  | Akses ditolak / CSRF / otorisasi gagal                  |
| `404`  | Resource tidak ditemukan                                |
| `409`  | Konflik data / duplikasi / status tidak sesuai          |
| `422`  | Validasi input gagal                                    |
| `429`  | Rate limit terlampaui                                   |
| `500`  | Kesalahan internal server                               |
| `503`  | Layanan eksternal (misalnya Apps Script) tidak tersedia |

## 3. Kode Error Terstandar (`shared/constants/api.ts`)

`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `EVENT_NOT_FOUND`, `EVENT_CLOSED`, `REGISTRATION_NOT_STARTED`, `REGISTRATION_CLOSED`, `DOWNLOAD_NOT_STARTED`, `DOWNLOAD_CLOSED`, `QUOTA_FULL`, `INVALID_ATTENDANCE`, `DUPLICATE_PARTICIPANT`, `INVALID_RECOVERY`, `TEMPLATE_INVALID`, `TEMPLATE_ACCESS_DENIED`, `GENERATION_PENDING`, `GENERATION_FAILED`, `DOCUMENT_REVOKED`, `EMAIL_QUOTA_EXCEEDED`, `RATE_LIMITED`, `INTEGRATION_UNAVAILABLE`, `INTERNAL_ERROR`.

## 4. Endpoint Aktif (Phase 0 & Phase 1)

### `GET /api/v1/health`

Memeriksa kesiapan runtime Cloudflare Worker dan konfigurasi dasar aplikasi (tanpa mengekspos secret atau detail infrastruktur sensitif).

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "ecer-api",
    "version": "0.1.0",
    "environment": "development",
    "timezone": "Asia/Jakarta",
    "timestamp": "2026-11-26T16:00:00.000Z"
  },
  "requestId": "uuid"
}
```

### Autentikasi Administrator (`/api/v1/auth/*`) _(Phase 1)_

- `POST /api/v1/auth/login` — Verifikasi Origin (CSRF), validasi Zod, verifikasi Turnstile (wajib di non-dev saat `TURNSTILE_SECRET_KEY` aktif), verifikasi PBKDF2-HMAC-SHA256, membuat sesi server-side di `admin_sessions`, dan mengirim cookie `HttpOnly` (`__Host-ecer_session` di HTTPS/production, `ecer_session` di local HTTP).
- `POST /api/v1/auth/logout` — Memerlukan CSRF Origin valid + sesi aktif; mencabut sesi di D1 dan menghapus cookie.
- `GET /api/v1/auth/me` — Memerlukan sesi aktif (memeriksa idle timeout 30 menit & absolute timeout 12 jam); mengembalikan profil admin tanpa password hash.
- `POST /api/v1/auth/change-password` — Memerlukan CSRF Origin valid + sesi aktif; memverifikasi password saat ini, memvalidasi kebijakan password baru (min 12 karakter), memperbarui hash, dan mencabut seluruh sesi admin lainnya secara atomik.

### Core Admin API (`/api/v1/admin/*`) _(Phase 2 — seluruhnya wajib sesi admin, mutasi wajib CSRF Origin)_

- `GET /api/v1/admin/dashboard` — Ringkasan metrik operasional & 8 aktivitas audit terbaru.
- `GET /api/v1/admin/users`, `POST /api/v1/admin/users`, `PATCH /api/v1/admin/users/:id`, `POST /api/v1/admin/users/:id/reset-password` — Manajemen multi-admin (menolak penonaktifan admin aktif terakhir dengan `409`; reset password mencabut seluruh sesi akun target).
- `GET /api/v1/admin/settings`, `PATCH /api/v1/admin/settings` — Pengaturan non-secret allowlisted.
- `GET /api/v1/admin/categories`, `POST /api/v1/admin/categories`, `PATCH /api/v1/admin/categories/:id` — Manajemen kategori kegiatan.
- `GET /api/v1/admin/audit-logs` — Riwayat audit log read-only terpaginasi (`page`, `limit`, filter `action` & `entityType`).
- `GET /api/v1/admin/integration/gas-health` — Pemeriksaan kesehatan integrasi bertanda tangan Worker ↔ Google Apps Script.
- `GET /api/v1/public/config` — Konfigurasi publik non-secret (`appName`, `organizationName`, `timezone`, `turnstileSiteKey`).

### Event Management & Flyer Storage (`/api/v1/admin/events/*`, `/api/v1/admin/storage/*`) _(Phase 3)_

- `GET /api/v1/admin/events` — Daftar kegiatan terpaginasi dengan filter `search`, `categoryId`, `status`.
- `POST /api/v1/admin/events` — Buat draft kegiatan baru (PIN di-hash, tidak pernah dikembalikan).
- `GET /api/v1/admin/events/:id` — Detail kegiatan + computed eligibility + `publishChecklist`.
- `PATCH /api/v1/admin/events/:id` — Perbarui data kegiatan, PIN, periode, atau flyer (dengan cleanup flyer lama di R2).
- `DELETE /api/v1/admin/events/:id` — Hapus draft kegiatan (ditolak jika bukan draft atau sudah memiliki peserta/dokumen).
- `POST /api/v1/admin/events/:id/publish`, `close`, `reopen`, `archive`, `duplicate` — Kontrol lifecycle & duplikasi (hasil duplikasi selalu `draft` tanpa menyalin PIN lama).
- `POST /api/v1/admin/storage/flyer`, `DELETE /api/v1/admin/storage/flyer/*` — Upload & hapus flyer R2 (JPEG/PNG/WebP maks. 5 MiB dengan validasi magic bytes, menolak SVG).
- `GET /api/v1/public/assets/flyers/*` — Melayani flyer kegiatan terpublikasi (flyer draft diblokir untuk publik).

### Templates & Dynamic Forms (`/api/v1/admin/templates/*`, `/api/v1/admin/events/:id/form`) _(Phase 4)_

- `GET /api/v1/admin/templates`, `POST /api/v1/admin/templates/import`, `GET/PATCH/DELETE /api/v1/admin/templates/:id` — Library template Google Docs (hanya URL resmi `docs.google.com/document/d/...`, ekstraksi placeholder via Apps Script, dilarang menghapus template yang sudah dipakai).
- `POST /api/v1/admin/templates/:id/refresh`, `validate`, `test-generate`, `GET /:id/versions` — Refresh versi baru, snapshot privat Google Docs, dan test PDF dummy tanpa nomor produksi.
- `GET /api/v1/admin/events/:id/form`, `PUT /api/v1/admin/events/:id/form`, `POST /api/v1/admin/events/:id/form/publish` — Dynamic form builder dengan versioning non-destruktif dan proteksi ReDoS.
- `GET/PUT /api/v1/admin/events/:id/templates` — Penautan versi template tervalidasi ke kegiatan.

### Public Dashboard, Registration & Participants (`/api/v1/public/*`, `/api/v1/admin/participants/*`) _(Phase 5)_

- `GET /api/v1/public/dashboard?month=&year=` — 3 indikator statistik bulanan (`Asia/Jakarta`, tanpa piagam) + daftar kategori aktif.
- `GET /api/v1/public/events?month=&year=&search=&categoryId=&status=` — Daftar kegiatan non-draft beririsan dengan bulan terpilih + real-time eligibility.
- `GET /api/v1/public/events/:slug` & `GET /api/v1/public/events/:slug/form` — Detail kegiatan + skema formulir aktif terpublikasi.
- `POST /api/v1/public/events/:slug/register` — Pendaftaran peserta (validasi periode, kuota, Turnstile, PIN/Whitelist, skema dinamis bersama, enkripsi AES-GCM PII, keyed HMAC duplicate prevention anti-enumerasi, dan 128-bit recovery code).
- `GET /api/v1/admin/events/:id/participants`, `POST /api/v1/admin/participants/:id/{approve,reject,cancel}`, `GET/POST /api/v1/admin/events/:id/whitelist` — Manajemen peserta, persetujuan manual, dan whitelist kehadiran.

### Document Numbering, Issuance & Generation Jobs (`/api/v1/admin/numbering/*`, `/admin/documents/*`, `/admin/jobs/*`) _(Phase 6)_

- `GET/POST /api/v1/admin/numbering`, `PATCH /api/v1/admin/numbering/:id`, `POST /api/v1/admin/numbering/preview` — Aturan penomoran atomik (`INSERT ... ON CONFLICT ... RETURNING`) dan preview format.
- `GET /api/v1/admin/documents`, `GET /api/v1/admin/documents/:id/revisions`, `POST /api/v1/admin/documents/:id/regenerate`, `POST /api/v1/admin/documents/:id/revoke` — Manajemen dokumen terbit, regenerasi revisi (nomor & kode verifikasi tetap), dan pencabutan dokumen.
- `GET /api/v1/admin/jobs/generation`, `GET /api/v1/admin/jobs/summary`, `POST /api/v1/admin/jobs/generation/:id/{retry,cancel}` — Monitoring dan kontrol antrean durable generation jobs + Cron recovery handler.

### Fallback API tidak dikenal (`ALL /api/*`)

Mengembalikan `404 Not Found` dalam format error JSON standar dengan kode `NOT_FOUND` (tidak pernah jatuh ke `index.html`).

## 5. Daftar Kelompok Endpoint Terencana (Phase 1–10)

Kontrak rinci tiap modul akan ditambahkan saat fase terkait diimplementasikan sesuai `PRD.md` §24:

- **Auth (`/api/v1/auth/*`)**: `login`, `logout`, `me`, `change-password` _(Phase 1)_
- **Public (`/api/v1/public/*`)**: `dashboard`, `events`, `events/:slug`, `events/:slug/form`, `register`, `search`, `recovery/verify`, `recovery/resend`, `submissions/:publicId/status`, `documents/:publicId/preview`, `documents/:publicId/download`, `verify/:verificationCode`, `assets/flyers/:assetId` _(Phase 5–7 — Terimplementasi)_
- **Admin (`/api/v1/admin/*`)**: `dashboard`, `events`, `templates`, `participants`, `documents` (termasuk `GET /documents/:id/download`), `awards`, `jobs`, `numbering`, `storage/flyer`, `settings`, `categories`, `users`, `audit-logs`, `reports` _(Phase 2–10)_

### Endpoint Phase 7 (PDF Delivery, Recovery & QR Verification)

| Method | Path                                          | Akses                         | Deskripsi                                                                                    |
| ------ | --------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| `POST` | `/api/v1/public/events/:slug/search`          | Publik + Turnstile            | Respon generik anti-enumerasi sebelum verifikasi kode pemulihan / OTP                        |
| `POST` | `/api/v1/public/recovery/verify`              | Publik + Turnstile            | Verifikasi kunci pencarian + recovery code / OTP email → menerbitkan cookie `download_grant` |
| `POST` | `/api/v1/public/recovery/resend`              | Publik + Turnstile (60s CD)   | Mengirim/menyiapkan OTP email 6 digit (TTL 5 menit, maks 5 percobaan)                        |
| `GET`  | `/api/v1/public/documents/:publicId/preview`  | Publik (Cookie `grant` aktif) | Streaming PDF `inline` dari Drive privat (memvalidasi periode unduh & status dokumen)        |
| `GET`  | `/api/v1/public/documents/:publicId/download` | Publik (Cookie `grant` aktif) | Streaming PDF `attachment` dari Drive privat (`Cache-Control: private, no-store`)            |
| `GET`  | `/api/v1/public/verify/:verificationCode`     | Publik (`noindex, nofollow`)  | Verifikasi QR publik (`VALID` / `REVOKED` / `NOT_FOUND` / `UNAVAILABLE`, nama termasking)    |
| `GET`  | `/api/v1/admin/documents/:id/download`        | Admin (`HttpOnly` session)    | Unduh PDF dokumen `ready` oleh admin (melampaui batas periode unduh publik)                  |

### Endpoint Phase 7 (PDF Delivery, Recovery & QR Verification)

| Method | Path                                          | Akses                         | Deskripsi                                                                                    |
| ------ | --------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| `POST` | `/api/v1/public/events/:slug/search`          | Publik + Turnstile            | Respon generik anti-enumerasi sebelum verifikasi kode pemulihan / OTP                        |
| `POST` | `/api/v1/public/recovery/verify`              | Publik + Turnstile            | Verifikasi kunci pencarian + recovery code / OTP email → menerbitkan cookie `download_grant` |
| `POST` | `/api/v1/public/recovery/resend`              | Publik + Turnstile (60s CD)   | Mengirim/menyiapkan OTP email 6 digit (TTL 5 menit, maks 5 percobaan)                        |
| `GET`  | `/api/v1/public/documents/:publicId/preview`  | Publik (Cookie `grant` aktif) | Streaming PDF `inline` dari Drive privat (memvalidasi periode unduh & status dokumen)        |
| `GET`  | `/api/v1/public/documents/:publicId/download` | Publik (Cookie `grant` aktif) | Streaming PDF `attachment` dari Drive privat (`Cache-Control: private, no-store`)            |
| `GET`  | `/api/v1/public/verify/:verificationCode`     | Publik (`noindex, nofollow`)  | Verifikasi QR publik (`VALID` / `REVOKED` / `NOT_FOUND` / `UNAVAILABLE`, nama termasking)    |
| `GET`  | `/api/v1/admin/documents/:id/download`        | Admin (`HttpOnly` session)    | Unduh PDF dokumen `ready` oleh admin (melampaui batas periode unduh publik)                  |

### Endpoint Phase 8 (Email Delivery & Monitor)

| Method | Path                                       | Akses                      | Deskripsi                                                                        |
| ------ | ------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/admin/jobs/email/summary`         | Admin (`HttpOnly` session) | Ringkasan status `email_jobs` + sisa kuota harian `MailApp` dari Apps Script     |
| `GET`  | `/api/v1/admin/jobs/email`                 | Admin (`HttpOnly` session) | Daftar paginasi `email_jobs` dengan alamat email termasking dan filter status    |
| `POST` | `/api/v1/admin/jobs/email/:id/retry`       | Admin + CSRF Origin        | Mengulang `email_job` (`failed`, `retry_wait`, `deferred_quota`, `needs_review`) |
| `POST` | `/api/v1/admin/jobs/email/:id/cancel`      | Admin + CSRF Origin        | Membatalkan `email_job` yang masih tertunda                                      |
| `POST` | `/api/v1/admin/documents/:id/resend-email` | Admin + CSRF Origin        | Mengirim ulang email sertifikat secara manual untuk dokumen berstatus `ready`    |

### Endpoint Phase 9 (Awards / Piagam)

| Method | Path                                       | Akses                      | Deskripsi                                                                       |
| ------ | ------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/admin/awards/templates`           | Admin (`HttpOnly` session) | Daftar kegiatan & template aktif bertipe `award` untuk form penerbitan piagam   |
| `GET`  | `/api/v1/admin/awards`                     | Admin (`HttpOnly` session) | Daftar paginasi piagam terbit (`document_type = 'award'`) dengan filter status  |
| `POST` | `/api/v1/admin/awards`                     | Admin + CSRF Origin        | Penerbitan piagam manual satuan (otomatis penomoran & antrean PDF)              |
| `POST` | `/api/v1/admin/awards/bulk-import`         | Admin + CSRF Origin        | Bulk import piagam hingga 100 baris/batch (sanitasi anti formula injection)     |
| `POST` | `/api/v1/admin/awards/import-participants` | Admin + CSRF Origin        | Import & terbitkan piagam dari daftar peserta terdaftar pada kegiatan yang sama |

### Endpoint Phase 10 (Reports & Retention Operations)

| Method | Path                                      | Akses                      | Deskripsi                                                                       |
| ------ | ----------------------------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/admin/reports/overview?year=`    | Admin (`HttpOnly` session) | Agregasi tahunan kegiatan, peserta, sertifikat, piagam, tren bulanan & kategori |
| `GET`  | `/api/v1/admin/reports/export.csv?year=`  | Admin (`HttpOnly` session) | Ekspor CSV aman (UTF-8 BOM, sanitasi anti formula injection) + audit log        |
| `GET`  | `/api/v1/admin/reports/retention/dry-run` | Admin (`HttpOnly` session) | Pratinjau jumlah sesi, grant, OTP, replay nonce kedaluwarsa & revisi superseded |
| `POST` | `/api/v1/admin/reports/retention/cleanup` | Admin + CSRF Origin        | Pembersihan aman token/sesi kedaluwarsa (tanpa menghapus dokumen/PDF)           |
