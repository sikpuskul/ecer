import { Hono, type Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { ERROR_CODES } from '../../../shared/constants/api';
import {
  PublicSearchRequestSchema,
  RecoveryResendOtpSchema,
  RecoveryVerifyRequestSchema,
  type RecoveredDocumentItem,
} from '../../../shared/schemas/recovery';
import { computeEventEligibility } from '../../../shared/utils/event-status';
import type { AppEnv } from '../../env';
import { GoogleAppsScriptClient } from '../../integrations/google-apps-script/client';
import { AppError } from '../../middleware/error-handler';
import {
  computeLookupHmac,
  generateOpaqueToken,
  hmacSha256Hex,
  sha256Hex,
  timingSafeEqualStrings,
} from '../../security/crypto';
import { verifyTurnstileToken } from '../../security/turnstile';
import { sendRecoveryOtpEmail } from '../email/service';
import { findPublicEventBySlug } from '../participants/repository';

const GRANT_TTL_MS = 10 * 60 * 1000; // 10 minutes (PRD §16.5)
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes (PRD §16.4)
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

function getGrantCookieName(c: Context<AppEnv>): string {
  const isSecure = c.env.APP_ENV === 'production' || c.req.url.startsWith('https://');
  return isSecure ? '__Host-ecer_grant' : 'ecer_grant';
}

function setGrantCookie(c: Context<AppEnv>, rawToken: string): void {
  const isSecure = c.env.APP_ENV === 'production' || c.req.url.startsWith('https://');
  setCookie(c, getGrantCookieName(c), rawToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    path: '/',
    maxAge: Math.floor(GRANT_TTL_MS / 1000),
  });
}

function generateSixDigitOtp(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String((bytes[0]! % 900_000) + 100_000);
}

export function createRecoveryRoutes() {
  const routes = new Hono<AppEnv>();

  // PRD §16.6: Generic anti-enumeration response before verification
  routes.post('/events/:slug/search', async (c) => {
    const requestId = c.get('requestId');
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = PublicSearchRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Masukkan kunci pencarian.',
        422,
      );
    }

    const turnstile = await verifyTurnstileToken({
      secretKey: c.env.TURNSTILE_SECRET_KEY,
      token: parsed.data.turnstileToken,
      remoteIp: c.req.header('cf-connecting-ip'),
      appEnv: c.env.APP_ENV,
    });
    if (!turnstile.ok) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Verifikasi Turnstile gagal.', 422);
    }

    c.header('Cache-Control', 'no-store');
    return c.json(
      {
        success: true as const,
        data: {
          message:
            'Jika data sesuai, masukkan kode pemulihan Anda (atau kode OTP email) untuk mengakses sertifikat.',
        },
        requestId,
      },
      200,
    );
  });

  // Verify search key + (recovery code OR email OTP) -> issue temporary HttpOnly download grant
  routes.post('/recovery/verify', async (c) => {
    const db = c.env.DB!;
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = RecoveryVerifyRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? 'Data verifikasi tidak lengkap.',
        422,
      );
    }

    const turnstile = await verifyTurnstileToken({
      secretKey: c.env.TURNSTILE_SECRET_KEY,
      token: parsed.data.turnstileToken,
      remoteIp: c.req.header('cf-connecting-ip'),
      appEnv: c.env.APP_ENV,
    });
    if (!turnstile.ok) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Verifikasi Turnstile gagal.', 422);
    }

    if (!c.env.LOOKUP_HMAC_KEY) {
      throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Konfigurasi kunci belum lengkap.', 500);
    }

    const genericFail = () =>
      new AppError(
        ERROR_CODES.INVALID_RECOVERY,
        'Data pencarian atau kode verifikasi tidak cocok. Periksa kembali atau hubungi panitia.',
        401,
      );

    const eventRow = await findPublicEventBySlug(db, parsed.data.slug);
    if (!eventRow) {
      throw genericFail();
    }

    const searchHash = await computeLookupHmac(c.env.LOOKUP_HMAC_KEY, parsed.data.searchKey);
    const participant = await db
      .prepare(
        `SELECT id, recovery_code_hash, submission_status
         FROM participants
         WHERE event_id = ?1 AND (search_key_hash = ?2 OR unique_key_hash = ?2)
         LIMIT 1`,
      )
      .bind(eventRow.id, searchHash)
      .first<{ id: string; recovery_code_hash: string; submission_status: string }>();

    if (!participant) {
      throw genericFail();
    }

    if (parsed.data.method === 'recovery_code') {
      const providedHash = await sha256Hex(parsed.data.code.trim().toUpperCase());
      if (!timingSafeEqualStrings(providedHash, participant.recovery_code_hash)) {
        throw genericFail();
      }
    } else {
      const nowIso = new Date().toISOString();
      const challenge = await db
        .prepare(
          `SELECT id, code_hash, attempts, expires_at
           FROM verification_challenges
           WHERE participant_id = ?1 AND challenge_type = 'email_otp' AND consumed_at IS NULL
           ORDER BY created_at DESC
           LIMIT 1`,
        )
        .bind(participant.id)
        .first<{ id: string; code_hash: string; attempts: number; expires_at: string }>();

      if (
        !challenge ||
        challenge.attempts >= OTP_MAX_ATTEMPTS ||
        Date.parse(challenge.expires_at) <= Date.now()
      ) {
        throw genericFail();
      }

      const providedOtpHmac = await hmacSha256Hex(
        c.env.LOOKUP_HMAC_KEY,
        `${challenge.id}:${parsed.data.code.trim()}`,
      );
      if (!timingSafeEqualStrings(providedOtpHmac, challenge.code_hash)) {
        await db
          .prepare(`UPDATE verification_challenges SET attempts = attempts + 1 WHERE id = ?1`)
          .bind(challenge.id)
          .run();
        throw genericFail();
      }

      await db
        .prepare(`UPDATE verification_challenges SET consumed_at = ?2 WHERE id = ?1`)
        .bind(challenge.id, nowIso)
        .run();
    }

    // PRD §18.4: Awards are never searchable via public certificate search
    const docsRes = await db
      .prepare(
        `SELECT id, public_id, document_number, document_status, issued_at
         FROM documents
         WHERE participant_id = ?1 AND event_id = ?2 AND document_type = 'certificate'
         ORDER BY created_at DESC`,
      )
      .bind(participant.id, eventRow.id)
      .all<{
        id: string;
        public_id: string;
        document_number: string;
        document_status: string;
        issued_at: string | null;
      }>();

    const eligibility = computeEventEligibility({
      lifecycleStatus: eventRow.lifecycle_status,
      registrationStartAt: eventRow.registration_start_at,
      registrationEndAt: eventRow.registration_end_at,
      downloadStartAt: eventRow.download_start_at,
      downloadEndAt: eventRow.download_end_at,
      quota: eventRow.quota,
      participantCount: Number(eventRow.participant_count ?? 0),
    });

    const docs = docsRes.results ?? [];
    const primaryDoc = docs.find((d) => d.document_status === 'ready') ?? docs[0];

    if (primaryDoc) {
      const rawGrantToken = generateOpaqueToken(32);
      const tokenHash = await sha256Hex(rawGrantToken);
      const nowMs = Date.now();
      await db
        .prepare(
          `INSERT INTO download_grants (id, document_id, token_hash, expires_at, revoked_at, created_at)
           VALUES (?1, ?2, ?3, ?4, NULL, ?5)`,
        )
        .bind(
          crypto.randomUUID(),
          primaryDoc.id,
          tokenHash,
          new Date(nowMs + GRANT_TTL_MS).toISOString(),
          new Date(nowMs).toISOString(),
        )
        .run();
      setGrantCookie(c, rawGrantToken);
    }

    const items: RecoveredDocumentItem[] = docs.map((d) => ({
      publicId: d.public_id,
      documentNumber: d.document_number,
      documentStatus: d.document_status,
      canDownload: eligibility.canDownload && d.document_status === 'ready',
      issuedAt: d.issued_at,
    }));

    c.header('Cache-Control', 'no-store');
    return c.json(
      {
        success: true as const,
        data: {
          submissionStatus: participant.submission_status,
          documents: items,
          downloadWindowOpen: eligibility.canDownload,
          grantExpiresInSeconds: Math.floor(GRANT_TTL_MS / 1000),
        },
        requestId,
      },
      200,
    );
  });

  // Request/resend email OTP with 60s cooldown and generic anti-enumeration response (PRD §16.4)
  routes.post('/recovery/resend', async (c) => {
    const db = c.env.DB!;
    const requestId = c.get('requestId');

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Body JSON tidak valid.', 400);
    }

    const parsed = RecoveryResendOtpSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Data permintaan OTP tidak valid.', 422);
    }

    const genericOk = () =>
      c.json(
        {
          success: true as const,
          data: {
            message:
              'Jika data dan email terdaftar pada kegiatan ini, kode OTP akan dikirimkan dan berlaku 5 menit.',
          },
          requestId,
        },
        200,
      );

    if (!c.env.LOOKUP_HMAC_KEY) {
      return genericOk();
    }

    const eventRow = await findPublicEventBySlug(db, parsed.data.slug);
    if (!eventRow) return genericOk();

    const searchHash = await computeLookupHmac(c.env.LOOKUP_HMAC_KEY, parsed.data.searchKey);
    const participant = await db
      .prepare(
        `SELECT id, email_encrypted
         FROM participants
         WHERE event_id = ?1 AND (search_key_hash = ?2 OR unique_key_hash = ?2)
         LIMIT 1`,
      )
      .bind(eventRow.id, searchHash)
      .first<{ id: string; email_encrypted: string | null }>();

    if (!participant || !participant.email_encrypted) return genericOk();

    const lastOtp = await db
      .prepare(
        `SELECT created_at FROM verification_challenges
         WHERE participant_id = ?1 AND challenge_type = 'email_otp'
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(participant.id)
      .first<{ created_at: string }>();

    if (lastOtp && Date.now() - Date.parse(lastOtp.created_at) < OTP_RESEND_COOLDOWN_MS) {
      throw new AppError(
        ERROR_CODES.RATE_LIMITED,
        'Mohon tunggu 60 detik sebelum meminta kode OTP baru.',
        429,
      );
    }

    const challengeId = crypto.randomUUID();
    const otp = generateSixDigitOtp();
    const codeHash = await hmacSha256Hex(c.env.LOOKUP_HMAC_KEY, `${challengeId}:${otp}`);
    const nowMs = Date.now();

    await db
      .prepare(
        `INSERT INTO verification_challenges (id, participant_id, challenge_type, code_hash, attempts, expires_at, consumed_at, created_at)
         VALUES (?1, ?2, 'email_otp', ?3, 0, ?4, NULL, ?5)`,
      )
      .bind(
        challengeId,
        participant.id,
        codeHash,
        new Date(nowMs + OTP_TTL_MS).toISOString(),
        new Date(nowMs).toISOString(),
      )
      .run();

    c.executionCtx.waitUntil(
      sendRecoveryOtpEmail(c.env, {
        emailEncrypted: participant.email_encrypted,
        eventTitle: eventRow.title,
        otpCode: otp,
        requestId,
      }),
    );

    c.header('Cache-Control', 'no-store');
    return genericOk();
  });

  // Authorized PDF preview & download (PRD §15.2, §15.3, AC-14, AC-15)
  async function handleAuthorizedPdf(c: Context<AppEnv>, disposition: 'inline' | 'attachment') {
    const db = c.env.DB!;
    const requestId = c.get('requestId');
    const publicId = c.req.param('publicId');

    const rawGrant = getCookie(c, getGrantCookieName(c));
    if (!rawGrant) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        'Otorisasi akses dokumen tidak ditemukan atau telah berakhir. Lakukan verifikasi ulang.',
        401,
      );
    }

    const grantHash = await sha256Hex(rawGrant);
    const record = await db
      .prepare(
        `SELECT d.id AS document_id, d.document_status,
                r.drive_file_id, r.filename,
                g.expires_at AS grant_expires_at, g.revoked_at AS grant_revoked_at,
                e.lifecycle_status, e.registration_start_at, e.registration_end_at,
                e.download_start_at, e.download_end_at, e.quota
         FROM documents d
         INNER JOIN download_grants g ON g.document_id = d.id AND g.token_hash = ?2
         INNER JOIN events e ON e.id = d.event_id
         LEFT JOIN document_revisions r ON r.id = d.current_revision_id
         WHERE d.public_id = ?1
         LIMIT 1`,
      )
      .bind(publicId, grantHash)
      .first<{
        document_id: string;
        document_status: string;
        drive_file_id: string | null;
        filename: string | null;
        grant_expires_at: string;
        grant_revoked_at: string | null;
        lifecycle_status: 'draft' | 'published' | 'closed' | 'archived';
        registration_start_at: string | null;
        registration_end_at: string | null;
        download_start_at: string | null;
        download_end_at: string | null;
        quota: number | null;
      }>();

    if (
      !record ||
      record.grant_revoked_at !== null ||
      Date.parse(record.grant_expires_at) <= Date.now()
    ) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        'Izin unduhan tidak valid atau kedaluwarsa.',
        401,
      );
    }

    if (record.document_status === 'revoked') {
      throw new AppError(
        ERROR_CODES.DOCUMENT_REVOKED,
        'Dokumen ini telah dicabut oleh penerbit.',
        403,
      );
    }

    if (record.document_status !== 'ready' || !record.drive_file_id) {
      throw new AppError(ERROR_CODES.GENERATION_PENDING, 'Dokumen PDF sedang diproses.', 409);
    }

    const eligibility = computeEventEligibility({
      lifecycleStatus: record.lifecycle_status,
      registrationStartAt: record.registration_start_at,
      registrationEndAt: record.registration_end_at,
      downloadStartAt: record.download_start_at,
      downloadEndAt: record.download_end_at,
      quota: record.quota,
      participantCount: 0,
    });

    if (!eligibility.canDownload) {
      throw new AppError(
        ERROR_CODES.DOWNLOAD_CLOSED,
        'Periode pengunduhan sertifikat untuk kegiatan ini tidak sedang dibuka.',
        403,
      );
    }

    if (!c.env.GAS_WEB_APP_URL || !c.env.GAS_SHARED_SECRET) {
      throw new AppError(
        ERROR_CODES.INTEGRATION_UNAVAILABLE,
        'Layanan penyimpanan dokumen sedang tidak tersedia.',
        503,
      );
    }

    const gas = new GoogleAppsScriptClient({
      webAppUrl: c.env.GAS_WEB_APP_URL,
      sharedSecret: c.env.GAS_SHARED_SECRET,
    });
    const pdf = await gas.fetchPdfBytes(
      { driveFileId: record.drive_file_id, expectedFilename: record.filename ?? undefined },
      requestId,
    );

    const safeFilename = (record.filename || pdf.filename || 'sertifikat.pdf').replace(/"/g, '');
    return new Response(pdf.bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${safeFilename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Request-Id': requestId,
      },
    });
  }

  routes.get('/documents/:publicId/preview', (c) => handleAuthorizedPdf(c, 'inline'));
  routes.get('/documents/:publicId/download', (c) => handleAuthorizedPdf(c, 'attachment'));

  return routes;
}
