#!/usr/bin/env node
/**
 * Secure Admin Bootstrap Generator (Local / Staging / Production CLI)
 *
 * Menghasilkan statement SQL untuk membuat akun administrator awal menggunakan
 * PBKDF2-HMAC-SHA256 (100.000 iterasi, salt acak 16 byte) tanpa menyimpan
 * password default di repository.
 *
 * Contoh penggunaan:
 *   node scripts/bootstrap-admin.mjs --username admin_pkm --display-name "Admin Puskesmas" --password "frasa-rahasia-panjang-anda"
 */

import { randomBytes, randomUUID, pbkdf2Sync } from 'node:crypto';

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_LENGTH = 32;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token?.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Argumen --${key} membutuhkan nilai.`);
      }
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

function escapeSql(value) {
  return value.replace(/'/g, "''");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const username = (args.username ?? '').trim();
  const displayName = (args['display-name'] ?? '').trim();
  const password = args.password ?? '';

  if (!username || !/^[a-zA-Z0-9._-]{3,64}$/.test(username)) {
    console.error('Error: --username wajib diisi (3-64 karakter: huruf, angka, ., _, -).');
    process.exit(1);
  }
  if (!displayName) {
    console.error('Error: --display-name wajib diisi.');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('Error: --password minimal 12 karakter sesuai kebijakan keamanan PRD §26.2.');
    process.exit(1);
  }

  const id = randomUUID();
  const salt = randomBytes(SALT_BYTES);
  const derived = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
  const passwordHash = `pbkdf2_sha256$${ITERATIONS}$${salt.toString('base64')}$${derived.toString('base64')}`;
  const nowIso = new Date().toISOString();

  const sql = `INSERT INTO admins (id, username, display_name, password_hash, password_algorithm, is_active, last_login_at, created_at, updated_at)
VALUES ('${id}', '${escapeSql(username)}', '${escapeSql(displayName)}', '${passwordHash}', 'pbkdf2-sha256-${ITERATIONS}', 1, NULL, '${nowIso}', '${nowIso}');`;

  console.log(
    '-- Jalankan SQL ini via: npx wrangler d1 execute ecer-local --local --command "<SQL>"',
  );
  console.log('-- Jangan simpan output ini ke repository Git!');
  console.log(sql);
}

main();
