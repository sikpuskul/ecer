import { ERROR_CODES } from '../../../shared/constants/api';
import type { AdminProfile } from '../../../shared/schemas/auth';
import { AppError } from '../../middleware/error-handler';
import { SESSION_ABSOLUTE_TIMEOUT_MS } from '../../middleware/auth';
import { generateOpaqueToken, sha256Hex } from '../../security/crypto';
import { hashPassword, validatePasswordPolicy, verifyPassword } from '../../security/password';
import {
  createAdminSession,
  findAdminById,
  findAdminByUsername,
  insertAuditLog,
  revokeSessionById,
  updateAdminLastLogin,
  updateAdminPasswordAndRevokeOtherSessions,
} from './repository';

export async function loginAdmin(
  db: D1Database,
  params: {
    username: string;
    password: string;
    requestId: string;
  },
): Promise<{ rawSessionToken: string; admin: AdminProfile }> {
  const admin = await findAdminByUsername(db, params.username);

  if (!admin || admin.is_active !== 1) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Username atau password tidak valid.', 401);
  }

  const valid = await verifyPassword(params.password, admin.password_hash);
  if (!valid) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Username atau password tidak valid.', 401);
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const expiresAtIso = new Date(nowMs + SESSION_ABSOLUTE_TIMEOUT_MS).toISOString();

  const rawSessionToken = generateOpaqueToken(32);
  const tokenHash = await sha256Hex(rawSessionToken);
  const sessionId = crypto.randomUUID();

  await createAdminSession(db, {
    id: sessionId,
    adminId: admin.id,
    tokenHash,
    expiresAt: expiresAtIso,
    nowIso,
  });

  await updateAdminLastLogin(db, admin.id, nowIso);

  await insertAuditLog(db, {
    adminId: admin.id,
    actorType: 'admin',
    action: 'auth.login',
    entityType: 'admin_session',
    entityId: sessionId,
    changeSummary: { username: admin.username },
    requestId: params.requestId,
  });

  return {
    rawSessionToken,
    admin: {
      id: admin.id,
      username: admin.username,
      displayName: admin.display_name,
      lastLoginAt: nowIso,
    },
  };
}

export async function logoutAdmin(
  db: D1Database,
  params: {
    adminId: string;
    sessionId: string;
    requestId: string;
  },
): Promise<void> {
  const nowIso = new Date().toISOString();
  await revokeSessionById(db, params.sessionId, nowIso);
  await insertAuditLog(db, {
    adminId: params.adminId,
    actorType: 'admin',
    action: 'auth.logout',
    entityType: 'admin_session',
    entityId: params.sessionId,
    requestId: params.requestId,
  });
}

export async function getAdminProfile(db: D1Database, adminId: string): Promise<AdminProfile> {
  const admin = await findAdminById(db, adminId);
  if (!admin || admin.is_active !== 1) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Akun administrator tidak aktif.', 401);
  }

  return {
    id: admin.id,
    username: admin.username,
    displayName: admin.display_name,
    lastLoginAt: admin.last_login_at,
  };
}

export async function changeAdminPassword(
  db: D1Database,
  params: {
    adminId: string;
    currentSessionId: string;
    currentPassword: string;
    newPassword: string;
    requestId: string;
  },
): Promise<void> {
  const admin = await findAdminById(db, params.adminId);
  if (!admin || admin.is_active !== 1) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Akun administrator tidak aktif.', 401);
  }

  const currentValid = await verifyPassword(params.currentPassword, admin.password_hash);
  if (!currentValid) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Password saat ini tidak sesuai.', 401);
  }

  const policy = validatePasswordPolicy(params.newPassword);
  if (!policy.valid) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      policy.reason ?? 'Password baru tidak memenuhi kebijakan keamanan.',
      422,
    );
  }

  const hashed = await hashPassword(params.newPassword);
  const nowIso = new Date().toISOString();

  await updateAdminPasswordAndRevokeOtherSessions(db, {
    adminId: admin.id,
    currentSessionId: params.currentSessionId,
    passwordHash: hashed.hash,
    passwordAlgorithm: hashed.algorithm,
    nowIso,
  });

  await insertAuditLog(db, {
    adminId: admin.id,
    actorType: 'admin',
    action: 'auth.change_password',
    entityType: 'admin',
    entityId: admin.id,
    changeSummary: { otherSessionsRevoked: true },
    requestId: params.requestId,
  });
}
