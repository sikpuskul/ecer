import { ERROR_CODES } from '../../../shared/constants/api';
import type {
  AdminUserItem,
  CreateAdminUserInput,
  UpdateAdminUserInput,
} from '../../../shared/schemas/admin';
import { AppError } from '../../middleware/error-handler';
import { hashPassword, validatePasswordPolicy } from '../../security/password';
import { findAdminByUsername, insertAuditLog } from '../auth/repository';
import {
  countActiveAdmins,
  createAdminRecord,
  findAdminItemById,
  listAdmins,
  resetAdminPasswordAndRevokeAllSessions,
  updateAdminRecord,
} from './repository';

export async function getAdminUsers(db: D1Database): Promise<AdminUserItem[]> {
  return listAdmins(db);
}

export async function createAdminUser(
  db: D1Database,
  params: {
    actorAdminId: string;
    input: CreateAdminUserInput;
    requestId: string;
  },
): Promise<AdminUserItem> {
  const existing = await findAdminByUsername(db, params.input.username);
  if (existing) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      'Username administrator sudah digunakan.',
      409,
    );
  }

  const policy = validatePasswordPolicy(params.input.password);
  if (!policy.valid) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      policy.reason ?? 'Password tidak memenuhi kebijakan keamanan.',
      422,
    );
  }

  const hashed = await hashPassword(params.input.password);
  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  await createAdminRecord(db, {
    id,
    username: params.input.username,
    displayName: params.input.displayName,
    passwordHash: hashed.hash,
    passwordAlgorithm: hashed.algorithm,
    nowIso,
  });

  await insertAuditLog(db, {
    adminId: params.actorAdminId,
    actorType: 'admin',
    action: 'admin_user.create',
    entityType: 'admin',
    entityId: id,
    changeSummary: { username: params.input.username, displayName: params.input.displayName },
    requestId: params.requestId,
  });

  return {
    id,
    username: params.input.username,
    displayName: params.input.displayName,
    isActive: true,
    lastLoginAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export async function updateAdminUser(
  db: D1Database,
  params: {
    actorAdminId: string;
    targetId: string;
    input: UpdateAdminUserInput;
    requestId: string;
  },
): Promise<AdminUserItem> {
  const target = await findAdminItemById(db, params.targetId);
  if (!target) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Akun administrator tidak ditemukan.', 404);
  }

  const nextActive = params.input.isActive ?? target.isActive;
  const nextDisplayName = params.input.displayName ?? target.displayName;

  if (target.isActive && !nextActive) {
    const activeCount = await countActiveAdmins(db);
    if (activeCount <= 1) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        'Tidak dapat menonaktifkan akun administrator aktif terakhir.',
        409,
      );
    }
  }

  const nowIso = new Date().toISOString();
  await updateAdminRecord(db, {
    id: target.id,
    displayName: nextDisplayName,
    isActive: nextActive,
    nowIso,
  });

  await insertAuditLog(db, {
    adminId: params.actorAdminId,
    actorType: 'admin',
    action: 'admin_user.update',
    entityType: 'admin',
    entityId: target.id,
    changeSummary: {
      displayNameChanged: nextDisplayName !== target.displayName,
      isActive: nextActive,
    },
    requestId: params.requestId,
  });

  return {
    ...target,
    displayName: nextDisplayName,
    isActive: nextActive,
    updatedAt: nowIso,
  };
}

export async function resetAdminUserPassword(
  db: D1Database,
  params: {
    actorAdminId: string;
    targetId: string;
    newPassword: string;
    requestId: string;
  },
): Promise<void> {
  const target = await findAdminItemById(db, params.targetId);
  if (!target) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Akun administrator tidak ditemukan.', 404);
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

  await resetAdminPasswordAndRevokeAllSessions(db, {
    id: target.id,
    passwordHash: hashed.hash,
    passwordAlgorithm: hashed.algorithm,
    nowIso,
  });

  await insertAuditLog(db, {
    adminId: params.actorAdminId,
    actorType: 'admin',
    action: 'admin_user.reset_password',
    entityType: 'admin',
    entityId: target.id,
    changeSummary: { sessionsRevoked: true },
    requestId: params.requestId,
  });
}
