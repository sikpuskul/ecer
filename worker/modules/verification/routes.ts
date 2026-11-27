import { Hono } from 'hono';
import type { PublicVerificationResult } from '../../../shared/schemas/recovery';
import type { TemplateDocumentType } from '../../../shared/schemas/templates';
import { maskRecipientName } from '../../../shared/utils/masking';
import type { AppEnv } from '../../env';
import { decryptSensitiveData } from '../../security/crypto';
import { listSettings } from '../settings/repository';

export function createVerificationRoutes() {
  const verify = new Hono<AppEnv>();

  // PRD §17.3–17.5: Public QR verification without PII leakage (AC-19, AC-20, AC-29)
  verify.get('/:verificationCode', async (c) => {
    const db = c.env.DB!;
    const requestId = c.get('requestId');
    const code = c.req.param('verificationCode').trim();

    c.header('X-Robots-Tag', 'noindex, nofollow');
    c.header('Cache-Control', 'no-store');

    if (!code || code.length < 8) {
      const notFound: PublicVerificationResult = { state: 'NOT_FOUND' };
      return c.json({ success: true as const, data: notFound, requestId }, 200);
    }

    const row = await db
      .prepare(
        `SELECT d.document_number, d.document_type, d.document_status,
                d.recipient_data_encrypted, d.issued_at, d.revoked_at, d.revoked_reason,
                e.title AS event_title, e.organizer,
                COALESCE(r.revision_number, 1) AS revision_number
         FROM documents d
         INNER JOIN events e ON e.id = d.event_id
         LEFT JOIN document_revisions r ON r.id = d.current_revision_id
         WHERE d.verification_code = ?1
         LIMIT 1`,
      )
      .bind(code)
      .first<{
        document_number: string;
        document_type: TemplateDocumentType;
        document_status: string;
        recipient_data_encrypted: string;
        issued_at: string | null;
        revoked_at: string | null;
        revoked_reason: string | null;
        event_title: string;
        organizer: string;
        revision_number: number;
      }>();

    if (!row) {
      const notFound: PublicVerificationResult = { state: 'NOT_FOUND' };
      return c.json({ success: true as const, data: notFound, requestId }, 200);
    }

    const settings = await listSettings(db);
    const shouldMask = settings.public_verification_mask_name !== 'false';

    let recipientName = 'Penerima Terdaftar';
    if (c.env.DATA_ENCRYPTION_KEY) {
      try {
        const raw = await decryptSensitiveData(row.recipient_data_encrypted, {
          v1: c.env.DATA_ENCRYPTION_KEY,
        });
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const fullName = String(parsed.nama_lengkap ?? parsed.nama ?? parsed.name ?? '');
        if (fullName) {
          recipientName = shouldMask ? maskRecipientName(fullName) : fullName;
        }
      } catch {
        recipientName = 'Penerima Terdaftar';
      }
    }

    if (row.document_status === 'revoked') {
      const revoked: PublicVerificationResult = {
        state: 'REVOKED',
        documentNumber: row.document_number,
        recipientName,
        eventTitle: row.event_title,
        documentType: row.document_type,
        issuedAt: row.issued_at,
        organizer: row.organizer,
        revokedAt: row.revoked_at,
        revokedReason: row.revoked_reason,
      };
      return c.json({ success: true as const, data: revoked, requestId }, 200);
    }

    if (row.document_status !== 'ready') {
      const unavailable: PublicVerificationResult = {
        state: 'UNAVAILABLE',
        documentNumber: row.document_number,
        eventTitle: row.event_title,
      };
      return c.json({ success: true as const, data: unavailable, requestId }, 200);
    }

    const valid: PublicVerificationResult = {
      state: 'VALID',
      documentNumber: row.document_number,
      recipientName,
      eventTitle: row.event_title,
      documentType: row.document_type,
      issuedAt: row.issued_at,
      organizer: row.organizer,
      revisionNumber: row.revision_number,
    };

    return c.json({ success: true as const, data: valid, requestId }, 200);
  });

  return verify;
}
