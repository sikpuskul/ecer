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

### Fallback API tidak dikenal (`ALL /api/*`)

Mengembalikan `404 Not Found` dalam format error JSON standar dengan kode `NOT_FOUND` (tidak pernah jatuh ke `index.html`).

## 5. Daftar Kelompok Endpoint Terencana (Phase 1–10)

Kontrak rinci tiap modul akan ditambahkan saat fase terkait diimplementasikan sesuai `PRD.md` §24:

- **Auth (`/api/v1/auth/*`)**: `login`, `logout`, `me`, `change-password` _(Phase 1)_
- **Public (`/api/v1/public/*`)**: `dashboard`, `events`, `events/:slug`, `events/:slug/form`, `register`, `search`, `recovery/verify`, `recovery/resend`, `submissions/:publicId/status`, `documents/:publicId/preview`, `documents/:publicId/download`, `verify/:verificationCode`, `assets/flyers/:assetId` _(Phase 5–7)_
- **Admin (`/api/v1/admin/*`)**: `dashboard`, `events`, `templates`, `participants`, `documents`, `awards`, `jobs`, `numbering`, `storage/flyer`, `settings`, `categories`, `users`, `audit-logs`, `reports` _(Phase 2–10)_
