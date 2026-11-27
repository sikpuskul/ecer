import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './auth';

export const CreateAdminUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter.')
    .max(64, 'Username maksimal 64 karakter.')
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      'Username hanya boleh huruf, angka, titik, garis bawah, atau tanda hubung.',
    ),
  displayName: z
    .string()
    .trim()
    .min(2, 'Nama tampilan minimal 2 karakter.')
    .max(100, 'Nama tampilan maksimal 100 karakter.'),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`)
    .max(PASSWORD_MAX_LENGTH, `Password maksimal ${PASSWORD_MAX_LENGTH} karakter.`),
});

export type CreateAdminUserInput = z.infer<typeof CreateAdminUserSchema>;

export const UpdateAdminUserSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, 'Nama tampilan minimal 2 karakter.')
      .max(100, 'Nama tampilan maksimal 100 karakter.')
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.displayName !== undefined || data.isActive !== undefined, {
    message: 'Minimal satu field harus diubah.',
  });

export type UpdateAdminUserInput = z.infer<typeof UpdateAdminUserSchema>;

export const ResetAdminPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password baru minimal ${PASSWORD_MIN_LENGTH} karakter.`)
    .max(PASSWORD_MAX_LENGTH, `Password baru maksimal ${PASSWORD_MAX_LENGTH} karakter.`),
});

export type ResetAdminPasswordInput = z.infer<typeof ResetAdminPasswordSchema>;

export const AdminUserItemSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  isActive: z.boolean(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AdminUserItem = z.infer<typeof AdminUserItemSchema>;

export const CreateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nama kategori minimal 2 karakter.')
    .max(80, 'Nama kategori maksimal 80 karakter.'),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug minimal 2 karakter.')
    .max(80, 'Slug maksimal 80 karakter.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung.')
    .optional(),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Nama kategori minimal 2 karakter.')
      .max(80, 'Nama kategori maksimal 80 karakter.')
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.name !== undefined || data.isActive !== undefined, {
    message: 'Minimal satu field harus diubah.',
  });

export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

export const EventCategoryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export type EventCategoryItem = z.infer<typeof EventCategoryItemSchema>;

export const ALLOWED_SETTING_KEYS = [
  'organization_name',
  'organization_code',
  'contact_email',
  'contact_phone',
  'public_verification_mask_name',
  'privacy_notice_version',
] as const;

export type SettingKey = (typeof ALLOWED_SETTING_KEYS)[number];

export const UpdateSettingsSchema = z.object({
  settings: z.record(z.enum(ALLOWED_SETTING_KEYS), z.string().max(300)),
});

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;

export const AuditLogItemSchema = z.object({
  id: z.string(),
  adminId: z.string().nullable(),
  adminUsername: z.string().nullable(),
  actorType: z.enum(['admin', 'system', 'public']),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  changeSummary: z.record(z.unknown()),
  requestId: z.string(),
  createdAt: z.string(),
});

export type AuditLogItem = z.infer<typeof AuditLogItemSchema>;

export const AdminDashboardSummarySchema = z.object({
  totalEvents: z.number().int().nonnegative(),
  activeEvents: z.number().int().nonnegative(),
  totalParticipants: z.number().int().nonnegative(),
  pendingApprovals: z.number().int().nonnegative(),
  certificatesIssued: z.number().int().nonnegative(),
  awardsIssued: z.number().int().nonnegative(),
  failedGenerationJobs: z.number().int().nonnegative(),
  pendingOrFailedEmails: z.number().int().nonnegative(),
  activeAdmins: z.number().int().nonnegative(),
  activeCategories: z.number().int().nonnegative(),
});

export type AdminDashboardSummary = z.infer<typeof AdminDashboardSummarySchema>;
