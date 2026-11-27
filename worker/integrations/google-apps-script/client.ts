import type { z } from 'zod';
import { ERROR_CODES } from '../../../shared/constants/api';
import { base64ToBytes } from '../../security/crypto';
import {
  createGasResponseSchema,
  GasDeleteFileDataSchema,
  GasEmailQuotaDataSchema,
  GasFetchPdfDataSchema,
  GasGenerateDocumentDataSchema,
  GasHealthDataSchema,
  GasInspectTemplateDataSchema,
  GasSendEmailDataSchema,
  GasSnapshotTemplateDataSchema,
} from './schemas';
import { createSignedEnvelope } from './signing';
import type { GasAction, GasClientConfig, GasResponseEnvelope } from './types';

export const ALLOWED_GAS_HOSTS = new Set(['script.google.com', 'script.googleusercontent.com']);

export const DEFAULT_MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MiB safe cap for Workers Free & high-res templates
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_REDIRECTS = 3;

const RETRYABLE_ACTIONS = new Set<GasAction>([
  'health',
  'inspect_template',
  'get_generation_result',
  'fetch_pdf',
  'get_email_quota',
]);

export class GasIntegrationError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly ambiguousTimeout: boolean;

  constructor(
    message: string,
    options: { code?: string; retryable?: boolean; ambiguousTimeout?: boolean } = {},
  ) {
    super(message);
    this.name = 'GasIntegrationError';
    this.code = options.code ?? ERROR_CODES.INTEGRATION_UNAVAILABLE;
    this.retryable = options.retryable ?? false;
    this.ambiguousTimeout = options.ambiguousTimeout ?? false;
  }
}

export function assertAllowedGasUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new GasIntegrationError('URL integrasi Google Apps Script tidak valid.');
  }

  if (parsed.protocol !== 'https:' || !ALLOWED_GAS_HOSTS.has(parsed.hostname)) {
    throw new GasIntegrationError(
      'Host integrasi Google Apps Script tidak termasuk dalam allowlist.',
    );
  }

  return parsed;
}

export function decodeAndValidatePdfBase64(
  contentBase64: string,
  maxBytes = DEFAULT_MAX_PDF_BYTES,
): Uint8Array {
  // Fast pre-check before allocating decoded buffer
  const estimatedBytes = Math.ceil((contentBase64.length * 3) / 4);
  if (estimatedBytes > maxBytes + 64) {
    throw new GasIntegrationError(
      `Ukuran PDF melebihi batas maksimal ${Math.floor(maxBytes / (1024 * 1024))} MiB.`,
      { code: ERROR_CODES.GENERATION_FAILED },
    );
  }

  const bytes = base64ToBytes(contentBase64);
  if (bytes.byteLength > maxBytes) {
    throw new GasIntegrationError(
      `Ukuran PDF melebihi batas maksimal ${Math.floor(maxBytes / (1024 * 1024))} MiB.`,
      { code: ERROR_CODES.GENERATION_FAILED },
    );
  }

  // Verify %PDF- magic header (0x25 0x50 0x44 0x46 0x2D)
  if (
    bytes.byteLength < 5 ||
    bytes[0] !== 0x25 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x44 ||
    bytes[3] !== 0x46 ||
    bytes[4] !== 0x2d
  ) {
    throw new GasIntegrationError('Konten dokumen yang diterima bukan berkas PDF yang valid.', {
      code: ERROR_CODES.GENERATION_FAILED,
    });
  }

  return bytes;
}

async function fetchWithAllowlistedRedirects(
  fetchImpl: typeof fetch,
  initialUrl: string,
  body: string,
  timeoutMs: number,
): Promise<Response> {
  const startUrl = assertAllowedGasUrl(initialUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = startUrl.toString();
    let method: 'POST' | 'GET' = 'POST';
    let payload: string | undefined = body;

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      const response = await fetchImpl(currentUrl, {
        method,
        headers:
          method === 'POST'
            ? {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              }
            : {
                Accept: 'application/json',
              },
        body: payload,
        redirect: 'manual',
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new GasIntegrationError('Redirect Apps Script tidak menyertakan header Location.');
        }
        const resolved = new URL(location, currentUrl);
        assertAllowedGasUrl(resolved.toString());
        currentUrl = resolved.toString();
        // Google ContentService redirects POST -> GET to script.googleusercontent.com;
        // never resend signed POST payload on redirect.
        method = 'GET';
        payload = undefined;
        continue;
      }

      return response;
    }

    throw new GasIntegrationError('Terlalu banyak redirect dari layanan Google Apps Script.');
  } finally {
    clearTimeout(timer);
  }
}

export class GoogleAppsScriptClient {
  private readonly webAppUrl: string;
  private readonly sharedSecret: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly maxPdfBytes: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: GasClientConfig) {
    assertAllowedGasUrl(config.webAppUrl);
    if (!config.sharedSecret || config.sharedSecret.length < 16) {
      throw new GasIntegrationError('GAS_SHARED_SECRET belum dikonfigurasi dengan benar.');
    }

    this.webAppUrl = config.webAppUrl;
    this.sharedSecret = config.sharedSecret;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.maxPdfBytes = config.maxPdfBytes ?? DEFAULT_MAX_PDF_BYTES;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async invoke<TData>(params: {
    action: GasAction;
    payload: Record<string, unknown>;
    requestId: string;
    dataSchema: z.ZodType<TData>;
  }): Promise<TData> {
    const canRetry = RETRYABLE_ACTIONS.has(params.action);
    const maxAttempts = canRetry ? this.maxRetries + 1 : 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const envelope = await createSignedEnvelope({
        action: params.action,
        payload: params.payload,
        requestId: params.requestId,
        secret: this.sharedSecret,
      });

      try {
        const response = await fetchWithAllowlistedRedirects(
          this.fetchImpl,
          this.webAppUrl,
          JSON.stringify(envelope),
          this.timeoutMs,
        );

        if (response.status >= 500) {
          throw new GasIntegrationError(
            `Layanan Google Apps Script mengembalikan HTTP ${response.status}.`,
            { retryable: canRetry },
          );
        }

        if (response.status >= 400) {
          throw new GasIntegrationError(
            `Google Apps Script menolak permintaan (HTTP ${response.status}). Periksa URL deployment dan izin Web App.`,
            { retryable: false },
          );
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.toLowerCase().includes('json')) {
          throw new GasIntegrationError(
            `Google Apps Script mengembalikan respons non-JSON (HTTP ${response.status}, ${contentType || 'unknown'}). Pastikan Web App di-deploy dengan Execute as: Me dan Who has access: Anyone serta sudah diotorisasi.`,
            { retryable: false },
          );
        }

        const rawJson: unknown = await response.json();
        const schema = createGasResponseSchema(params.dataSchema);
        const parsed = schema.safeParse(rawJson);

        if (!parsed.success) {
          throw new GasIntegrationError(
            'Format respons JSON dari Google Apps Script tidak sesuai kontrak.',
          );
        }

        const envelopeResult = parsed.data as GasResponseEnvelope<TData>;
        if (!envelopeResult.success) {
          throw new GasIntegrationError(envelopeResult.error.message, {
            code: envelopeResult.error.code,
            retryable: false,
          });
        }

        return envelopeResult.data;
      } catch (error) {
        lastError = error;

        const isAbort = error instanceof Error && error.name === 'AbortError';
        if (isAbort && params.action === 'send_email') {
          throw new GasIntegrationError(
            'Timeout saat mengirim email via Apps Script; status pengiriman perlu peninjauan.',
            {
              code: ERROR_CODES.INTEGRATION_UNAVAILABLE,
              retryable: false,
              ambiguousTimeout: true,
            },
          );
        }

        const shouldRetry =
          attempt < maxAttempts &&
          canRetry &&
          (isAbort ||
            (error instanceof GasIntegrationError && error.retryable) ||
            !(error instanceof GasIntegrationError));

        if (!shouldRetry) {
          if (error instanceof GasIntegrationError) {
            throw error;
          }
          throw new GasIntegrationError('Gagal menghubungi layanan Google Apps Script.', {
            retryable: canRetry,
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new GasIntegrationError('Gagal menghubungi layanan Google Apps Script.');
  }

  health(requestId: string) {
    return this.invoke({
      action: 'health',
      payload: {},
      requestId,
      dataSchema: GasHealthDataSchema,
    });
  }

  inspectTemplate(googleDocId: string, requestId: string) {
    return this.invoke({
      action: 'inspect_template',
      payload: { googleDocId },
      requestId,
      dataSchema: GasInspectTemplateDataSchema,
    });
  }

  snapshotTemplate(params: { googleDocId: string; snapshotName: string }, requestId: string) {
    return this.invoke({
      action: 'snapshot_template',
      payload: params,
      requestId,
      dataSchema: GasSnapshotTemplateDataSchema,
    });
  }

  generateDocument(
    params: {
      jobId: string;
      snapshotDocId: string;
      documentType: 'certificate' | 'award';
      eventId: string;
      year: string;
      filename: string;
      placeholders: Record<string, string>;
      qrPngBase64?: string;
    },
    requestId: string,
  ) {
    return this.invoke({
      action: 'generate_document',
      payload: params,
      requestId,
      dataSchema: GasGenerateDocumentDataSchema,
    });
  }

  getGenerationResult(jobId: string, requestId: string) {
    return this.invoke({
      action: 'get_generation_result',
      payload: { jobId },
      requestId,
      dataSchema: GasGenerateDocumentDataSchema,
    });
  }

  async fetchPdfBytes(
    params: { driveFileId: string; expectedFilename?: string },
    requestId: string,
  ): Promise<{ filename: string; mimeType: 'application/pdf'; bytes: Uint8Array }> {
    const result = await this.invoke({
      action: 'fetch_pdf',
      payload: params,
      requestId,
      dataSchema: GasFetchPdfDataSchema,
    });

    const bytes = decodeAndValidatePdfBase64(result.contentBase64, this.maxPdfBytes);
    return {
      filename: result.filename,
      mimeType: result.mimeType,
      bytes,
    };
  }

  getEmailQuota(requestId: string) {
    return this.invoke({
      action: 'get_email_quota',
      payload: {},
      requestId,
      dataSchema: GasEmailQuotaDataSchema,
    });
  }

  sendEmail(
    params: {
      jobId: string;
      to: string;
      subject: string;
      body: string;
      driveFileId?: string;
    },
    requestId: string,
  ) {
    return this.invoke({
      action: 'send_email',
      payload: params,
      requestId,
      dataSchema: GasSendEmailDataSchema,
    });
  }

  deleteManagedFile(driveFileId: string, requestId: string) {
    return this.invoke({
      action: 'delete_managed_file',
      payload: { driveFileId },
      requestId,
      dataSchema: GasDeleteFileDataSchema,
    });
  }
}
