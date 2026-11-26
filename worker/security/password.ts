import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../shared/schemas/auth';
import { base64ToBytes, bytesToBase64, timingSafeEqual } from './crypto';

export const PBKDF2_DEFAULT_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const DERIVED_KEY_BITS = 256;
const HASH_PREFIX = 'pbkdf2_sha256';

const COMMON_WEAK_PASSWORDS = new Set([
  'password1234',
  'password12345',
  '123456789012',
  'qwertyuiop12',
  'admin1234567',
  'puskesmas123',
  'sumbermanjing',
  'administrator',
]);

const textEncoder = new TextEncoder();

export interface PasswordHashResult {
  hash: string;
  algorithm: string;
}

export function validatePasswordPolicy(password: string): { valid: boolean; reason?: string } {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, reason: `Password minimal ${PASSWORD_MIN_LENGTH} karakter.` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { valid: false, reason: `Password maksimal ${PASSWORD_MAX_LENGTH} karakter.` };
  }
  const normalized = password.trim().toLowerCase();
  if (COMMON_WEAK_PASSWORDS.has(normalized)) {
    return {
      valid: false,
      reason: 'Password terlalu umum. Gunakan kombinasi frasa yang lebih kuat.',
    };
  }
  if (/^(.)\1+$/.test(password)) {
    return { valid: false, reason: 'Password tidak boleh hanya berisi satu karakter berulang.' };
  }
  return { valid: true };
}

async function derivePbkdf2Bits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt as BufferSource,
      iterations,
    },
    keyMaterial,
    DERIVED_KEY_BITS,
  );

  return new Uint8Array(derived);
}

export async function hashPassword(
  password: string,
  iterations = PBKDF2_DEFAULT_ITERATIONS,
): Promise<PasswordHashResult> {
  if (iterations < 100_000) {
    throw new Error('PBKDF2 iterations must be at least 100,000');
  }
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);

  const derived = await derivePbkdf2Bits(password, salt, iterations);
  const hash = `${HASH_PREFIX}$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(derived)}`;

  return {
    hash,
    algorithm: `pbkdf2-sha256-${iterations}`,
  };
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 4) {
    return false;
  }
  const [prefix, iterStr, saltB64, expectedB64] = parts;
  if (prefix !== HASH_PREFIX || !iterStr || !saltB64 || !expectedB64) {
    return false;
  }

  const iterations = Number.parseInt(iterStr, 10);
  if (!Number.isFinite(iterations) || iterations < 100_000 || iterations > 600_000) {
    return false;
  }

  try {
    const salt = base64ToBytes(saltB64);
    const expected = base64ToBytes(expectedB64);
    const actual = await derivePbkdf2Bits(password, salt, iterations);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
