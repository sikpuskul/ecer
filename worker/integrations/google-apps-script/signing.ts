import {
  generateOpaqueToken,
  hmacSha256Hex,
  sha256Hex,
  timingSafeEqualStrings,
} from '../../security/crypto';
import {
  GAS_ALLOWED_ACTIONS,
  GAS_PROTOCOL_VERSION,
  type GasAction,
  type GasRequestEnvelope,
} from './types';

export const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes (PRD §25.3)

const ALLOWED_ACTION_SET = new Set<string>(GAS_ALLOWED_ACTIONS);

/**
 * Deterministic canonical JSON serialization with lexicographically sorted object keys.
 * Both Worker and Google Apps Script use this exact canonicalization before SHA-256 hashing.
 */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJsonStringify(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj)
    .filter((key) => obj[key] !== undefined)
    .sort();
  const entries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJsonStringify(obj[key])}`,
  );
  return `{${entries.join(',')}}`;
}

export function buildCanonicalSigningString(params: {
  version: string;
  timestamp: number;
  nonce: string;
  action: string;
  payloadHash: string;
}): string {
  return [
    params.version,
    String(params.timestamp),
    params.nonce,
    params.action,
    params.payloadHash,
  ].join('|');
}

export async function createSignedEnvelope<TPayload extends Record<string, unknown>>(params: {
  action: GasAction;
  payload: TPayload;
  requestId: string;
  secret: string;
  nowSeconds?: number;
  nonce?: string;
}): Promise<GasRequestEnvelope<TPayload>> {
  const timestamp = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const nonce = params.nonce ?? generateOpaqueToken(18);
  const canonicalPayload = canonicalJsonStringify(params.payload);
  const payloadHash = await sha256Hex(canonicalPayload);
  const signingContent = buildCanonicalSigningString({
    version: GAS_PROTOCOL_VERSION,
    timestamp,
    nonce,
    action: params.action,
    payloadHash,
  });
  const signature = await hmacSha256Hex(params.secret, signingContent);

  return {
    version: GAS_PROTOCOL_VERSION,
    action: params.action,
    timestamp,
    nonce,
    requestId: params.requestId,
    payload: params.payload,
    signature,
  };
}

export async function verifySignedEnvelope(params: {
  envelope: GasRequestEnvelope;
  secret: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): Promise<{ valid: boolean; reason?: string }> {
  const { envelope, secret } = params;
  const nowSeconds = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const toleranceSeconds = params.toleranceSeconds ?? DEFAULT_TIMESTAMP_TOLERANCE_SECONDS;

  if (envelope.version !== GAS_PROTOCOL_VERSION) {
    return { valid: false, reason: 'UNSUPPORTED_VERSION' };
  }
  if (!ALLOWED_ACTION_SET.has(envelope.action)) {
    return { valid: false, reason: 'ACTION_NOT_ALLOWED' };
  }
  if (Math.abs(nowSeconds - envelope.timestamp) > toleranceSeconds) {
    return { valid: false, reason: 'TIMESTAMP_EXPIRED' };
  }

  const canonicalPayload = canonicalJsonStringify(envelope.payload);
  const payloadHash = await sha256Hex(canonicalPayload);
  const signingContent = buildCanonicalSigningString({
    version: envelope.version,
    timestamp: envelope.timestamp,
    nonce: envelope.nonce,
    action: envelope.action,
    payloadHash,
  });
  const expectedSignature = await hmacSha256Hex(secret, signingContent);

  if (!timingSafeEqualStrings(expectedSignature, envelope.signature)) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  return { valid: true };
}
