import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { ERROR_CODES } from '../../../shared/constants/api';
import type { AppEnv } from '../../env';
import { getSessionCookieName, requireAdminAuth } from '../../middleware/auth';
import { csrfOriginMiddleware } from '../../middleware/csrf';
import { AppError } from '../../middleware/error-handler';
import { sha256Hex } from '../../security/crypto';
import { findActiveSessionByTokenHash, insertAuditLog } from '../auth/repository';

export const MAX_FLYER_BYTES = 5 * 1024 * 1024; // 5 MiB (PRD §28.2)

type SupportedImageFormat = {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  ext: 'jpg' | 'png' | 'webp';
};

/**
 * Validates actual file magic bytes (never trusts client MIME header alone).
 * Explicitly rejects SVG and non-raster formats (PRD §28.1).
 */
export function detectFlyerImageFormat(bytes: Uint8Array): SupportedImageFormat | null {
  if (bytes.byteLength < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mimeType: 'image/png', ext: 'png' };
  }

  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mimeType: 'image/webp', ext: 'webp' };
  }

  return null;
}

export function isValidFlyerKey(key: string): boolean {
  return /^flyers\/[a-zA-Z0-9_-]+\/[a-f0-9-]+\.(jpg|png|webp)$/.test(key);
}

export function createAdminStorageRoutes() {
  const storage = new Hono<AppEnv>();

  storage.use('*', requireAdminAuth);

  storage.post('/flyer', csrfOriginMiddleware, async (c) => {
    const bucket = c.env.FLYER_BUCKET;
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    if (!bucket) {
      throw new AppError(
        ERROR_CODES.INTERNAL_ERROR,
        'Penyimpanan R2 flyer belum dikonfigurasi.',
        500,
      );
    }

    let formData: FormData;
    try {
      formData = await c.req.formData();
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Form upload flyer tidak valid.', 400);
    }

    const fileEntry = formData.get('file');
    if (!(fileEntry instanceof File)) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Berkas flyer wajib diunggah.', 422);
    }

    if (fileEntry.size === 0 || fileEntry.size > MAX_FLYER_BYTES) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Ukuran flyer harus antara 1 byte hingga 5 MiB.',
        422,
      );
    }

    const buffer = await fileEntry.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const detected = detectFlyerImageFormat(bytes);

    if (!detected) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Format flyer tidak didukung. Gunakan gambar JPEG, PNG, atau WebP (SVG tidak diizinkan).',
        422,
      );
    }

    const rawEventId = formData.get('eventId');
    const safeEventSegment =
      typeof rawEventId === 'string' && /^[a-zA-Z0-9_-]{4,64}$/.test(rawEventId.trim())
        ? rawEventId.trim()
        : 'unassigned';

    const objectKey = `flyers/${safeEventSegment}/${crypto.randomUUID()}.${detected.ext}`;

    await bucket.put(objectKey, bytes, {
      httpMetadata: {
        contentType: detected.mimeType,
      },
    });

    await insertAuditLog(db, {
      adminId: admin.id,
      actorType: 'admin',
      action: 'storage.flyer_upload',
      entityType: 'flyer',
      entityId: objectKey,
      changeSummary: { mimeType: detected.mimeType, sizeBytes: bytes.byteLength },
      requestId,
    });

    return c.json(
      {
        success: true as const,
        data: {
          flyerKey: objectKey,
          flyerUrl: `/api/v1/public/assets/${objectKey}`,
          mimeType: detected.mimeType,
          sizeBytes: bytes.byteLength,
        },
        requestId,
      },
      201,
    );
  });

  storage.delete('/flyer/*', csrfOriginMiddleware, async (c) => {
    const bucket = c.env.FLYER_BUCKET;
    const db = c.env.DB!;
    const admin = c.get('admin')!;
    const requestId = c.get('requestId');

    if (!bucket) {
      throw new AppError(
        ERROR_CODES.INTERNAL_ERROR,
        'Penyimpanan R2 flyer belum dikonfigurasi.',
        500,
      );
    }

    const prefix = '/api/v1/admin/storage/flyer/';
    const pathname = new URL(c.req.url).pathname;
    const objectKey = decodeURIComponent(pathname.slice(prefix.length));

    if (!isValidFlyerKey(objectKey)) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Key flyer tidak valid.', 400);
    }

    await bucket.delete(objectKey);

    await insertAuditLog(db, {
      adminId: admin.id,
      actorType: 'admin',
      action: 'storage.flyer_delete',
      entityType: 'flyer',
      entityId: objectKey,
      requestId,
    });

    return c.json({ success: true as const, data: { deleted: true }, requestId }, 200);
  });

  return storage;
}

export function createPublicAssetRoutes() {
  const assets = new Hono<AppEnv>();

  assets.get('/flyers/*', async (c) => {
    const bucket = c.env.FLYER_BUCKET;
    const db = c.env.DB;
    if (!bucket || !db) {
      return c.text('Not Found', 404);
    }

    const prefix = '/api/v1/public/assets/';
    const pathname = new URL(c.req.url).pathname;
    const objectKey = decodeURIComponent(pathname.slice(prefix.length));

    if (!isValidFlyerKey(objectKey)) {
      return c.text('Not Found', 404);
    }

    // PRD §28.4: Draft flyers must never be publicly accessible
    const linkedEvent = await db
      .prepare(`SELECT lifecycle_status FROM events WHERE flyer_key = ?1 LIMIT 1`)
      .bind(objectKey)
      .first<{ lifecycle_status: string }>();

    const isPubliclyVisible = linkedEvent !== null && linkedEvent.lifecycle_status !== 'draft';

    if (!isPubliclyVisible) {
      const rawToken = getCookie(c, getSessionCookieName(c));
      if (!rawToken) {
        return c.text('Not Found', 404);
      }
      const tokenHash = await sha256Hex(rawToken);
      const session = await findActiveSessionByTokenHash(db, tokenHash);
      if (!session || session.is_active !== 1 || session.revoked_at !== null) {
        return c.text('Not Found', 404);
      }
    }

    const object = await bucket.get(objectKey);
    if (!object) {
      return c.text('Not Found', 404);
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType ?? 'image/webp');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set(
      'Cache-Control',
      isPubliclyVisible ? 'public, max-age=86400, immutable' : 'private, no-store',
    );

    return new Response(object.body, { status: 200, headers });
  });

  return assets;
}
