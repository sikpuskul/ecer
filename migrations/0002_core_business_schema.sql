-- Phase 2: Core Business Schema (17 remaining tables + required indexes + initial seeds)
-- Single Source of Truth: Cloudflare D1 (SQLite)

PRAGMA foreign_keys = ON;

-- 1. Event Categories
CREATE TABLE IF NOT EXISTS event_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL
);

-- Seed 9 initial categories per PRD §8.2
INSERT OR IGNORE INTO event_categories (id, name, slug, is_active, created_at) VALUES
  ('cat-pelatihan', 'Pelatihan', 'pelatihan', 1, '2026-01-01T00:00:00.000Z'),
  ('cat-workshop', 'Workshop', 'workshop', 1, '2026-01-01T00:00:00.000Z'),
  ('cat-sosialisasi', 'Sosialisasi', 'sosialisasi', 1, '2026-01-01T00:00:00.000Z'),
  ('cat-seminar', 'Seminar', 'seminar', 1, '2026-01-01T00:00:00.000Z'),
  ('cat-lintas-sektor', 'Pertemuan Lintas Sektor', 'pertemuan-lintas-sektor', 1, '2026-01-01T00:00:00.000Z'),
  ('cat-lintas-program', 'Pertemuan Lintas Program', 'pertemuan-lintas-program', 1, '2026-01-01T00:00:00.000Z'),
  ('cat-bimtek', 'Bimbingan Teknis', 'bimbingan-teknis', 1, '2026-01-01T00:00:00.000Z'),
  ('cat-penghargaan', 'Penghargaan', 'penghargaan', 1, '2026-01-01T00:00:00.000Z'),
  ('cat-lainnya', 'Lainnya', 'lainnya', 1, '2026-01-01T00:00:00.000Z');

-- 2. Events
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES event_categories(id),
  slug TEXT NOT NULL UNIQUE,
  event_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  organizer TEXT NOT NULL DEFAULT 'Puskesmas Sumbermanjing Kulon',
  location TEXT NOT NULL DEFAULT '',
  flyer_key TEXT NULL,
  event_start_at TEXT NOT NULL,
  event_end_at TEXT NOT NULL,
  publish_at TEXT NULL,
  registration_start_at TEXT NULL,
  registration_end_at TEXT NULL,
  download_start_at TEXT NULL,
  download_end_at TEXT NULL,
  email_release_at TEXT NULL,
  quota INTEGER NULL CHECK (quota IS NULL OR quota > 0),
  attendance_mode TEXT NOT NULL DEFAULT 'open' CHECK (attendance_mode IN ('open', 'pin', 'whitelist')),
  issuance_mode TEXT NOT NULL DEFAULT 'auto' CHECK (issuance_mode IN ('auto', 'manual_approval')),
  lifecycle_status TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle_status IN ('draft', 'published', 'closed', 'archived')),
  unique_key_field TEXT NOT NULL DEFAULT 'nomor_peserta',
  search_key_field TEXT NOT NULL DEFAULT 'nomor_peserta',
  event_pin_hash TEXT NULL,
  email_config_json TEXT NOT NULL DEFAULT '{}',
  retention_config_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL REFERENCES admins(id),
  updated_by TEXT NOT NULL REFERENCES admins(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_lifecycle_publish
  ON events (lifecycle_status, publish_at);

CREATE INDEX IF NOT EXISTS idx_events_date_range
  ON events (event_start_at, event_end_at);

-- 3. Templates
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  document_type TEXT NOT NULL CHECK (document_type IN ('certificate', 'award')),
  google_doc_id TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_by TEXT NOT NULL REFERENCES admins(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 4. Template Versions
CREATE TABLE IF NOT EXISTS template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  snapshot_doc_id TEXT NULL,
  placeholders_json TEXT NOT NULL DEFAULT '[]',
  mapping_schema_json TEXT NOT NULL DEFAULT '{}',
  validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'warning', 'invalid')),
  created_by TEXT NOT NULL REFERENCES admins(id),
  created_at TEXT NOT NULL,
  UNIQUE (template_id, version_number)
);

-- 5. Numbering Rules
CREATE TABLE IF NOT EXISTS numbering_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('certificate', 'award')),
  format_pattern TEXT NOT NULL,
  sequence_padding INTEGER NOT NULL DEFAULT 3 CHECK (sequence_padding BETWEEN 1 AND 8),
  starting_number INTEGER NOT NULL DEFAULT 1 CHECK (starting_number >= 1),
  reset_strategy TEXT NOT NULL DEFAULT 'yearly' CHECK (reset_strategy IN ('never', 'monthly', 'yearly', 'per_event')),
  organization_code TEXT NOT NULL DEFAULT 'PKM-SMK',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 6. Numbering Counters
CREATE TABLE IF NOT EXISTS numbering_counters (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES numbering_rules(id),
  scope_key TEXT NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE (rule_id, scope_key)
);

-- 7. Event Templates
CREATE TABLE IF NOT EXISTS event_templates (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  template_version_id TEXT NOT NULL REFERENCES template_versions(id),
  numbering_rule_id TEXT NOT NULL REFERENCES numbering_rules(id),
  category_name TEXT NOT NULL,
  eligibility_json TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

-- 8. Form Versions
CREATE TABLE IF NOT EXISTS form_versions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  schema_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by TEXT NOT NULL REFERENCES admins(id),
  created_at TEXT NOT NULL,
  UNIQUE (event_id, version_number)
);

-- 9. Participants
CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  form_version_id TEXT NOT NULL REFERENCES form_versions(id),
  unique_key_hash TEXT NOT NULL,
  search_key_hash TEXT NOT NULL,
  encrypted_data TEXT NOT NULL,
  email_encrypted TEXT NULL,
  recovery_code_hash TEXT NOT NULL,
  submission_status TEXT NOT NULL DEFAULT 'submitted' CHECK (submission_status IN ('submitted', 'pending_review', 'approved', 'rejected', 'cancelled')),
  consent_version TEXT NOT NULL,
  consented_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  approved_by TEXT NULL REFERENCES admins(id),
  approved_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, unique_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_participants_event_status
  ON participants (event_id, submission_status);

CREATE INDEX IF NOT EXISTS idx_participants_event_search
  ON participants (event_id, search_key_hash);

-- 10. Event Whitelist
CREATE TABLE IF NOT EXISTS event_whitelist (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  whitelist_key_hash TEXT NOT NULL,
  encrypted_data TEXT NOT NULL DEFAULT '',
  used_by_participant_id TEXT NULL REFERENCES participants(id),
  created_at TEXT NOT NULL,
  UNIQUE (event_id, whitelist_key_hash)
);

-- 11. Documents (Unified certificates & awards)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL REFERENCES events(id),
  participant_id TEXT NULL REFERENCES participants(id),
  event_template_id TEXT NOT NULL REFERENCES event_templates(id),
  template_version_id TEXT NOT NULL REFERENCES template_versions(id),
  numbering_rule_id TEXT NOT NULL REFERENCES numbering_rules(id),
  document_type TEXT NOT NULL CHECK (document_type IN ('certificate', 'award')),
  document_number TEXT NOT NULL UNIQUE,
  verification_code TEXT NOT NULL UNIQUE,
  issuance_key TEXT NOT NULL UNIQUE,
  recipient_data_encrypted TEXT NOT NULL,
  current_revision_id TEXT NULL,
  document_status TEXT NOT NULL DEFAULT 'queued' CHECK (document_status IN ('queued', 'processing', 'ready', 'failed', 'revoked')),
  issued_at TEXT NULL,
  revoked_at TEXT NULL,
  revoked_reason TEXT NULL,
  created_by TEXT NULL REFERENCES admins(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_event_status
  ON documents (event_id, document_status);

CREATE INDEX IF NOT EXISTS idx_documents_participant
  ON documents (participant_id);

CREATE INDEX IF NOT EXISTS idx_documents_type_issued
  ON documents (document_type, issued_at);

-- 12. Document Revisions
CREATE TABLE IF NOT EXISTS document_revisions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  template_version_id TEXT NOT NULL REFERENCES template_versions(id),
  data_snapshot_encrypted TEXT NOT NULL,
  drive_file_id TEXT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_size INTEGER NOT NULL DEFAULT 0,
  checksum TEXT NULL,
  revision_status TEXT NOT NULL DEFAULT 'queued' CHECK (revision_status IN ('queued', 'processing', 'ready', 'superseded', 'failed')),
  created_by TEXT NULL REFERENCES admins(id),
  created_at TEXT NOT NULL,
  UNIQUE (document_id, revision_number)
);

-- 13. Generation Jobs
CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  job_status TEXT NOT NULL DEFAULT 'queued' CHECK (job_status IN ('queued', 'processing', 'retry_wait', 'succeeded', 'failed', 'cancelled', 'needs_review')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TEXT NULL,
  lease_expires_at TEXT NULL,
  claimed_by TEXT NULL,
  error_code TEXT NULL,
  safe_error_message TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_next
  ON generation_jobs (job_status, next_attempt_at);

-- 14. Email Jobs
CREATE TABLE IF NOT EXISTS email_jobs (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  revision_id TEXT NOT NULL REFERENCES document_revisions(id) ON DELETE CASCADE,
  recipient_email_encrypted TEXT NOT NULL,
  email_template_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL UNIQUE,
  job_status TEXT NOT NULL DEFAULT 'queued' CHECK (job_status IN ('queued', 'processing', 'sent', 'failed', 'deferred_quota', 'retry_wait', 'needs_review', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NULL,
  lease_expires_at TEXT NULL,
  sent_at TEXT NULL,
  error_code TEXT NULL,
  safe_error_message TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_jobs_status_next
  ON email_jobs (job_status, next_attempt_at);

-- 15. Download Grants
CREATE TABLE IF NOT EXISTS download_grants (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_download_grants_expires_at
  ON download_grants (expires_at);

-- 16. Verification Challenges (Email OTP)
CREATE TABLE IF NOT EXISTS verification_challenges (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('email_otp')),
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NULL,
  created_at TEXT NOT NULL
);

-- 17. App Settings (Non-secret configuration only; secrets belong in Worker Secrets)
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_by TEXT NULL REFERENCES admins(id),
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO app_settings (setting_key, setting_value, updated_by, updated_at) VALUES
  ('organization_name', 'Puskesmas Sumbermanjing Kulon', NULL, '2026-01-01T00:00:00.000Z'),
  ('organization_code', 'PKM-SMK', NULL, '2026-01-01T00:00:00.000Z'),
  ('contact_email', '', NULL, '2026-01-01T00:00:00.000Z'),
  ('contact_phone', '', NULL, '2026-01-01T00:00:00.000Z'),
  ('public_verification_mask_name', 'true', NULL, '2026-01-01T00:00:00.000Z'),
  ('privacy_notice_version', '1.0', NULL, '2026-01-01T00:00:00.000Z');
