import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const LoginRequestSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter.')
    .max(64, 'Username maksimal 64 karakter.')
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      'Username hanya boleh huruf, angka, titik, garis bawah, atau tanda hubung.',
    ),
  password: z
    .string()
    .min(1, 'Password wajib diisi.')
    .max(PASSWORD_MAX_LENGTH, `Password maksimal ${PASSWORD_MAX_LENGTH} karakter.`),
  turnstileToken: z.string().min(1).max(4096).optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi.').max(PASSWORD_MAX_LENGTH),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password baru minimal ${PASSWORD_MIN_LENGTH} karakter.`)
    .max(PASSWORD_MAX_LENGTH, `Password baru maksimal ${PASSWORD_MAX_LENGTH} karakter.`),
});

export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export const AdminProfileSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1),
  lastLoginAt: z.string().datetime().nullable(),
});

export type AdminProfile = z.infer<typeof AdminProfileSchema>;
