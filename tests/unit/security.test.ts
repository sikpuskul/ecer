import { describe, expect, it } from 'vitest';
import {
  bytesToBase64,
  computeLookupHmac,
  decryptSensitiveData,
  encryptSensitiveData,
  generateOpaqueToken,
  sha256Hex,
} from '@worker/security/crypto';
import {
  hashPassword,
  PBKDF2_DEFAULT_ITERATIONS,
  validatePasswordPolicy,
  verifyPassword,
} from '@worker/security/password';
import { decodeAndValidatePdfBase64 } from '@worker/integrations/google-apps-script/client';

function makeRandomBase64Key(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

describe('Phase 1 — Cryptography & Password KDF', () => {
  it('enforces password policy (min 12 chars, rejects common weak passwords)', () => {
    expect(validatePasswordPolicy('short123').valid).toBe(false);
    expect(validatePasswordPolicy('password1234').valid).toBe(false);
    expect(validatePasswordPolicy('aaaaaaaaaaaa').valid).toBe(false);
    expect(validatePasswordPolicy('puskesmas sumbermanjing sehat 2026').valid).toBe(true);
  });

  it('hashes and verifies passwords with PBKDF2-HMAC-SHA256 (100k iterations)', async () => {
    const start = performance.now();
    const { hash, algorithm } = await hashPassword('kader-kesehatan-sumbermanjing-2026');
    const hashMs = performance.now() - start;

    expect(algorithm).toBe(`pbkdf2-sha256-${PBKDF2_DEFAULT_ITERATIONS}`);
    expect(hash.startsWith('pbkdf2_sha256$100000$')).toBe(true);

    const verifyStart = performance.now();
    const ok = await verifyPassword('kader-kesehatan-sumbermanjing-2026', hash);
    const verifyMs = performance.now() - verifyStart;

    expect(ok).toBe(true);
    expect(await verifyPassword('salah-password-12345', hash)).toBe(false);
    expect(hashMs).toBeGreaterThanOrEqual(0);
    expect(verifyMs).toBeGreaterThanOrEqual(0);
  });

  it('encrypts and decrypts sensitive data with AES-GCM, unique IVs, and key version rotation', async () => {
    const keyV1 = makeRandomBase64Key();
    const keyV2 = makeRandomBase64Key();

    const plaintext = JSON.stringify({ nama: 'Siti Dummy', nik: '3507000000000001' });
    const encA = await encryptSensitiveData(plaintext, keyV1, 'v1');
    const encB = await encryptSensitiveData(plaintext, keyV1, 'v1');

    expect(encA).not.toBe(encB); // Unique random IV
    expect(encA.startsWith('v1:')).toBe(true);

    const decV1 = await decryptSensitiveData(encA, { v1: keyV1, v2: keyV2 });
    expect(decV1).toBe(plaintext);

    const encV2 = await encryptSensitiveData(plaintext, keyV2, 'v2');
    expect(await decryptSensitiveData(encV2, { v1: keyV1, v2: keyV2 })).toBe(plaintext);

    // Tampered ciphertext must throw
    const tampered = `${encA.slice(0, -4)}AAAA`;
    await expect(decryptSensitiveData(tampered, { v1: keyV1 })).rejects.toThrow();
  });

  it('computes deterministic normalized keyed HMAC lookup hashes', async () => {
    const hmacKey = makeRandomBase64Key();
    const a = await computeLookupHmac(hmacKey, '  PESERTA-001 ');
    const b = await computeLookupHmac(hmacKey, 'peserta-001');
    const other = await computeLookupHmac(hmacKey, 'peserta-002');

    expect(a).toBe(b);
    expect(a).not.toBe(other);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates high-entropy opaque tokens and decodes a synthetic 1.5 MiB PDF payload', async () => {
    const t1 = generateOpaqueToken(32);
    const t2 = generateOpaqueToken(32);
    expect(t1).not.toBe(t2);
    expect((await sha256Hex(t1)).length).toBe(64);

    // Synthetic 1.5 MiB PDF payload (under 2 MiB cap)
    const size = 1_500_000;
    const pdfBytes = new Uint8Array(size);
    pdfBytes.set([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7
    const b64 = bytesToBase64(pdfBytes);

    const decoded = decodeAndValidatePdfBase64(b64);
    expect(decoded.byteLength).toBe(size);
  });
});
