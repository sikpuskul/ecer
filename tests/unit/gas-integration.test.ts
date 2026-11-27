import { describe, expect, it } from 'vitest';
import {
  decodeAndValidatePdfBase64,
  GasIntegrationError,
  GoogleAppsScriptClient,
} from '@worker/integrations/google-apps-script/client';
import {
  canonicalJsonStringify,
  createSignedEnvelope,
  verifySignedEnvelope,
} from '@worker/integrations/google-apps-script/signing';
import { bytesToBase64 } from '@worker/security/crypto';

const TEST_GAS_URL = 'https://script.google.com/macros/s/AKfycb_test_deployment/exec';
const TEST_SECRET = 'test-shared-secret-minimum-32-chars-ecer';

describe('Phase 1 — Signed Google Apps Script Integration', () => {
  it('canonicalizes JSON deterministically and verifies HMAC-SHA256 signatures', async () => {
    const a = canonicalJsonStringify({ b: 2, a: { d: 4, c: 3 } });
    const b = canonicalJsonStringify({ a: { c: 3, d: 4 }, b: 2 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":3,"d":4},"b":2}');

    const nowSec = 1_780_000_000;
    const envelope = await createSignedEnvelope({
      action: 'inspect_template',
      payload: { googleDocId: 'doc_123' },
      requestId: 'req-12345678',
      secret: TEST_SECRET,
      nowSeconds: nowSec,
    });

    const valid = await verifySignedEnvelope({
      envelope,
      secret: TEST_SECRET,
      nowSeconds: nowSec + 120,
    });
    expect(valid.valid).toBe(true);

    // Tampered payload rejected
    const tampered = await verifySignedEnvelope({
      envelope: { ...envelope, payload: { googleDocId: 'doc_999' } },
      secret: TEST_SECRET,
      nowSeconds: nowSec + 10,
    });
    expect(tampered.valid).toBe(false);
    expect(tampered.reason).toBe('INVALID_SIGNATURE');

    // Expired timestamp (>5 min) rejected
    const expired = await verifySignedEnvelope({
      envelope,
      secret: TEST_SECRET,
      nowSeconds: nowSec + 301,
    });
    expect(expired.valid).toBe(false);
    expect(expired.reason).toBe('TIMESTAMP_EXPIRED');
  });

  it('follows allowlisted 302 ContentService redirects via GET without resending POST body', async () => {
    const calls: Array<{ url: string; method: string; hasBody: boolean }> = [];

    const mockFetch: typeof fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      calls.push({
        url,
        method: init?.method ?? 'GET',
        hasBody: init?.body !== undefined,
      });

      if (calls.length === 1) {
        return new Response(null, {
          status: 302,
          headers: {
            Location: 'https://script.googleusercontent.com/macros/echo?user_content_key=abc',
          },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          requestId: 'req-health-1',
          data: {
            status: 'ok',
            environment: 'staging',
            remainingEmailQuota: 98,
            timestamp: '2026-11-26T16:00:00.000Z',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const client = new GoogleAppsScriptClient({
      webAppUrl: TEST_GAS_URL,
      sharedSecret: TEST_SECRET,
      fetchImpl: mockFetch,
    });

    const result = await client.health('req-health-1');
    expect(result.status).toBe('ok');
    expect(result.remainingEmailQuota).toBe(98);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ method: 'POST', hasBody: true });
    expect(calls[1]).toMatchObject({ method: 'GET', hasBody: false });
  });

  it('blocks redirects to untrusted hosts', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(null, {
        status: 302,
        headers: { Location: 'https://evil.example.com/steal' },
      });

    const client = new GoogleAppsScriptClient({
      webAppUrl: TEST_GAS_URL,
      sharedSecret: TEST_SECRET,
      maxRetries: 0,
      fetchImpl: mockFetch,
    });

    await expect(client.health('req-evil-1')).rejects.toThrow(/allowlist/i);
  });

  it('retries transient 503 on idempotent actions and does not retry send_email on ambiguous timeout', async () => {
    let attempts = 0;
    const retryingFetch: typeof fetch = async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response('Temporary error', { status: 503 });
      }
      return new Response(
        JSON.stringify({
          success: true,
          requestId: 'req-quota-1',
          data: {
            remainingDailyQuota: 75,
            checkedAt: '2026-11-26T16:00:00.000Z',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const client = new GoogleAppsScriptClient({
      webAppUrl: TEST_GAS_URL,
      sharedSecret: TEST_SECRET,
      maxRetries: 2,
      fetchImpl: retryingFetch,
    });

    const quota = await client.getEmailQuota('req-quota-1');
    expect(quota.remainingDailyQuota).toBe(75);
    expect(attempts).toBe(2);

    // Timeout on send_email must NOT retry and must flag ambiguousTimeout
    let emailAttempts = 0;
    const timeoutFetch: typeof fetch = async (_input, init) => {
      emailAttempts += 1;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const abortErr = new Error('Aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      });
    };

    const emailClient = new GoogleAppsScriptClient({
      webAppUrl: TEST_GAS_URL,
      sharedSecret: TEST_SECRET,
      timeoutMs: 30,
      maxRetries: 2,
      fetchImpl: timeoutFetch,
    });

    try {
      await emailClient.sendEmail(
        {
          jobId: 'job-email-1',
          to: 'peserta@example.test',
          subject: 'Sertifikat Test',
          body: 'Terlampir',
          driveFileId: 'drive-file-1',
        },
        'req-email-1',
      );
      expect.unreachable('sendEmail should have thrown on timeout');
    } catch (err) {
      expect(err).toBeInstanceOf(GasIntegrationError);
      expect((err as GasIntegrationError).ambiguousTimeout).toBe(true);
      expect(emailAttempts).toBe(1);
    }
  });

  it('validates PDF magic bytes and enforces 5 MiB size limit', () => {
    const validPdf = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
    const decoded = decodeAndValidatePdfBase64(bytesToBase64(validPdf));
    expect(decoded.byteLength).toBe(validPdf.byteLength);

    const notPdf = new TextEncoder().encode('<html>Not a PDF</html>');
    expect(() => decodeAndValidatePdfBase64(bytesToBase64(notPdf))).toThrow(/bukan berkas PDF/i);

    const oversized = new Uint8Array(5 * 1024 * 1024 + 1024);
    oversized.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(() => decodeAndValidatePdfBase64(bytesToBase64(oversized))).toThrow(/melebihi batas/i);
  });
});
