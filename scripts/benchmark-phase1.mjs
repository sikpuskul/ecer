#!/usr/bin/env node
/**
 * Phase 1 Technical Gate — Local Crypto & PDF Base64 Benchmark
 * Mengukur waktu eksekusi PBKDF2-HMAC-SHA256 (100k), AES-GCM, dan decoding base64 PDF (2 MiB).
 * Catatan: Hasil Node.js lokal adalah indikasi awal; benchmark final tetap harus diverifikasi
 * pada runtime Cloudflare Workers staging terhadap batas 10 ms CPU Free Tier.
 */

import { performance } from 'node:perf_hooks';

async function main() {
  const enc = new TextEncoder();

  // 1. PBKDF2-HMAC-SHA256 (100,000 iterations)
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const keyMat = await crypto.subtle.importKey(
    'raw',
    enc.encode('kader-kesehatan-sumbermanjing-2026'),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );

  const pbkdf2Runs = [];
  for (let i = 0; i < 5; i += 1) {
    const t0 = performance.now();
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
      keyMat,
      256,
    );
    pbkdf2Runs.push(performance.now() - t0);
  }

  // 2. AES-GCM 256-bit encrypt + decrypt
  const rawAes = new Uint8Array(32);
  crypto.getRandomValues(rawAes);
  const aesKey = await crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const samplePii = enc.encode(JSON.stringify({ nama: 'Peserta Dummy', nik: '3507000000000001' }));

  const tAes0 = performance.now();
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, samplePii);
  await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, cipher);
  const aesMs = performance.now() - tAes0;

  // 3. Base64 decode 2 MiB PDF
  const pdfSize = 2 * 1024 * 1024;
  const pdfBytes = new Uint8Array(pdfSize);
  pdfBytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const b64 = Buffer.from(pdfBytes).toString('base64');

  const tPdf0 = performance.now();
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  const pdfDecodeMs = performance.now() - tPdf0;

  const avgPbkdf2 = pbkdf2Runs.reduce((a, b) => a + b, 0) / pbkdf2Runs.length;
  console.log(
    JSON.stringify(
      {
        runtime: `node ${process.version}`,
        pbkdf2_100k_avg_ms: Number(avgPbkdf2.toFixed(2)),
        pbkdf2_100k_runs_ms: pbkdf2Runs.map((v) => Number(v.toFixed(2))),
        aes_gcm_roundtrip_ms: Number(aesMs.toFixed(2)),
        pdf_2mib_base64_decode_ms: Number(pdfDecodeMs.toFixed(2)),
        decoded_bytes: out.byteLength,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
