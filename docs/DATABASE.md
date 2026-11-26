# Rancangan Database — ECER (Cloudflare D1)

Dokumen ini merangkum rancangan skema database Cloudflare D1 (SQLite) berdasarkan `PRD.md` §23.

> **Status Phase 0**: Belum ada database lokal maupun produksi yang dibuat dan belum ada berkas SQL migration. Setup D1 lokal dimulai pada **Phase 1**, sedangkan seluruh SQL migration inti dan ERD Mermaid aktual akan dihasilkan pada **Phase 2**.

## 1. Konvensi Database

- **Primary Key**: UUID v4 (`TEXT PRIMARY KEY`).
- **Penamaan**: `snake_case` untuk seluruh tabel dan kolom.
- **Timestamp**: Disimpan dalam format ISO-8601 **UTC** (`TEXT`); konversi `Asia/Jakarta` dilakukan di lapisan presentasi/input.
- **Integritas**: Aktifkan dan verifikasi `PRAGMA foreign_keys = ON`, gunakan `CHECK` constraints untuk enum status, serta `UNIQUE` constraints untuk aturan bisnis.
- **Query safety**: Selalu gunakan parameterized SQL; hindari `SELECT *` pada endpoint produksi.
- **Larangan penyimpanan**: Dilarang menyimpan binary PDF atau base64 PDF permanen di D1. Dilarang menyimpan secret di `app_settings`.

## 2. Daftar Tabel Terencana (21 Tabel)

| Domain                   | Tabel                                                                | Fungsi Utama                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Autentikasi & Admin**  | `admins`, `admin_sessions`, `app_settings`, `audit_logs`             | Akun multi-admin, sesi server-side (hanya token hash), konfigurasi non-secret, dan jejak audit tanpa PII mentah.                 |
| **Kegiatan**             | `event_categories`, `events`, `event_whitelist`                      | Master kategori kegiatan, metadata & periode kegiatan, serta daftar whitelist peserta (key hash + data terenkripsi).             |
| **Template & Formulir**  | `templates`, `template_versions`, `event_templates`, `form_versions` | Library Google Docs reusable, snapshot versi template, pemetaan template per kegiatan, dan skema formulir berversi.              |
| **Peserta & Verifikasi** | `participants`, `verification_challenges`, `download_grants`         | Data pengajuan peserta (terenkripsi AES-GCM + keyed HMAC lookup), tantangan OTP sekali pakai, dan token grant unduhan sementara. |
| **Penomoran**            | `numbering_rules`, `numbering_counters`                              | Pola penomoran dokumen dan counter atomik (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`).                                    |
| **Dokumen & Jobs**       | `documents`, `document_revisions`, `generation_jobs`, `email_jobs`   | Satu tabel `documents` (`certificate` / `award`), riwayat revisi PDF di Drive privat, antrean durable generation & email jobs.   |
| **Keamanan Integrasi**   | `integration_replays`                                                | Pencegahan replay attack berbasis `nonce_hash` dengan TTL.                                                                       |

## 3. Strategi Keamanan Data di D1

- **Enkripsi kolom sensitif**: `participants.encrypted_data`, `participants.email_encrypted`, `event_whitelist.encrypted_data`, `documents.recipient_data_encrypted`, `document_revisions.data_snapshot_encrypted`, dan `email_jobs.recipient_email_encrypted` menggunakan **AES-GCM** dengan unique random IV dan metadata versi kunci (`DATA_ENCRYPTION_KEY`).
- **Pencarian exact match**: `unique_key_hash`, `search_key_hash`, dan `whitelist_key_hash` menggunakan **keyed HMAC-SHA256** (`LOOKUP_HMAC_KEY`), bukan hash tanpa secret.
- **Unique constraints kritis**:
  - `participants(event_id, unique_key_hash)` — mencegah duplikasi peserta secara atomik.
  - `numbering_counters(rule_id, scope_key)` — mencegah tabrakan urutan nomor dokumen.
  - `documents(document_number)`, `documents(verification_code)`, `documents(issuance_key)` — menjamin keunikan nomor, kode verifikasi, dan idempotensi penerbitan.
  - `generation_jobs(idempotency_key)`, `email_jobs(idempotency_key)` — menjamin idempotensi antrean.

## 4. Indeks Wajib

Sesuai `PRD.md` §23.23, indeks berikut wajib dibuat pada migration Phase 2:

- `events(lifecycle_status, publish_at)` dan `events(event_start_at, event_end_at)`
- `participants(event_id, submission_status)` dan `participants(event_id, search_key_hash)`
- `documents(event_id, document_status)`, `documents(participant_id)`, dan `documents(document_type, issued_at)`
- `generation_jobs(job_status, next_attempt_at)` dan `email_jobs(job_status, next_attempt_at)`
- `admin_sessions(expires_at)` dan `download_grants(expires_at)`
- `audit_logs(entity_type, entity_id)` dan `audit_logs(created_at)`

## 5. ERD

Diagram ERD Mermaid aktual akan digenerate di bagian ini setelah berkas SQL migration selesai diverifikasi pada Phase 2.
