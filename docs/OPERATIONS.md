# Panduan Operasional, Backup & Pemulihan — ECER

Dokumen ini menjadi runbook operasional resmi untuk pengelola **ECER** (_Sertifikat dan Piagam Digital_ Puskesmas Sumbermanjing Kulon) di lingkungan Cloudflare Workers + D1 + R2 + Google Apps Script.

---

## 1. Pemantauan Kesehatan Harian

1. **API Health Check**: `GET /api/v1/health` harus mengembalikan HTTP `200` dengan `"status": "ok"`.
2. **Integrasi Google Apps Script & Kuota Email**:
   - Buka menu **Admin → Monitor Email** (`/admin/email`) untuk memeriksa sisa kuota harian `MailApp` dan jumlah job berstatus `deferred_quota` atau `failed`.
   - Jika kuota harian habis, sistem otomatis menunda pengiriman (`deferred_quota`) hingga pukul `00:10 WIB` hari berikutnya dan Cron Workers akan melanjutkannya secara otomatis.
3. **Antrean PDF (`generation_jobs`)**:
   - Buka menu **Admin → Generation Jobs** (`/admin/jobs`).
   - Cron Workers berjalan berkala untuk mengambil ulang job berstatus `queued`, `retry_wait`, atau lease `processing` yang kedaluwarsa (>2 menit).

---

## 2. Backup & Pemulihan Database (Cloudflare D1)

D1 merupakan _single source of truth_ untuk seluruh data kegiatan, peserta (terenkripsi), dokumen, dan audit log.

### 2.1 Backup Manual Periodik (Disarankan Mingguan)

```powershell
# Export snapshot SQL terenkripsi ke folder lokal aman (JANGAN commit ke Git!)
npx wrangler d1 export ecer-prod --remote --output="backup-ecer-$(Get-Date -Format 'yyyyMMdd').sql"
```

Simpan hasil export di media penyimpanan terenkripsi milik instansi. Jangan pernah mengunggah file `.sql` ke repositori publik.

### 2.2 Pemulihan via Cloudflare D1 Time Travel

Cloudflare D1 menyediakan _Time Travel_ (point-in-time recovery):

```powershell
# Lihat bookmark / timestamp terakhir
npx wrangler d1 time-travel info ecer-prod

# Pulihkan ke timestamp tertentu (WAJIB persetujuan pemilik proyek sebelum dijalankan di produksi)
npx wrangler d1 time-travel restore ecer-prod --timestamp="2026-11-27T00:00:00Z"
```

---

## 3. Retensi Data & Kebersihan Operasional

Gunakan halaman **Admin → Laporan & Retensi** (`/admin/laporan`):

1. **Dry-Run Retensi**: Periksa jumlah sesi admin kedaluwarsa, `download_grants` habis masa berlaku, `verification_challenges` (OTP) kedaluwarsa, `integration_replays`, serta revisi PDF `superseded` berusia >90 hari.
2. **Pembersihan Token Kedaluwarsa**: Tombol **Bersihkan Token Kedaluwarsa** hanya menghapus data keamanan sementara yang sudah kedaluwarsa dan **tidak pernah** menghapus catatan peserta, sertifikat/piagam, atau file PDF di Google Drive.

---

## 4. Rotasi Secret & Kunci Kriptografi

Seluruh secret wajib disimpan di **Cloudflare Workers Secrets** (`wrangler secret put`) dan **Google Apps Script Script Properties** — tidak pernah di dalam kode atau `wrangler.jsonc`.

| Secret                   | Dampak Rotasi                       | Prosedur Aman                                                                                                             |
| ------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SIGNING_SECRET` | Sesi admin aktif lama tidak berlaku | Set secret baru via `wrangler secret put`; admin login ulang.                                                             |
| `GAS_SHARED_SECRET`      | Komunikasi Worker ↔ Apps Script     | Perbarui bersamaan di Script Properties Apps Script & Workers Secret, lalu uji di `/api/v1/admin/integration/gas-health`. |
| `TURNSTILE_SECRET_KEY`   | Validasi captcha publik & login     | Rotasi di Cloudflare Turnstile dashboard, lalu perbarui Workers Secret.                                                   |
| `DATA_ENCRYPTION_KEY`    | Enkripsi PII D1 (berversi `v1:...`) | Tambahkan versi kunci baru (`v2`) tanpa menghapus `v1` sampai seluruh baris lama selesai dire-enkripsi.                   |

---

## 5. Checklist Respons Insiden

1. **Kebocoran Dokumen / Sertifikat Salah Terbit**:
   - Buka **Admin → Sertifikat** atau **Admin → Piagam**, klik **Cabut (Revoke)** dan isi alasan.
   - Sistem langsung membatalkan seluruh `download_grants` aktif dan mengubah status QR verifikasi publik menjadi `REVOKED`.
2. **Dugaan Kompromi Akun Admin**:
   - Segera ganti kata sandi admin (otomatis mencabut seluruh sesi aktif admin tersebut) atau nonaktifkan akun melalui admin aktif lainnya.
   - Tinjau jejak aktivitas di **Admin → Audit Log** (`/admin/audit-log`).
3. **Gangguan Google Apps Script / Drive**:
   - Tidak ada data pendaftaran yang hilang karena D1 menyimpan seluruh data peserta dan antrean `generation_jobs`.
   - Setelah layanan Google pulih, Cron otomatis memproses ulang antrean, atau admin dapat menekan tombol **Retry** di `/admin/jobs`.
