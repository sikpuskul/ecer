import { z } from 'zod';
import type { TemplateDocumentType } from './templates';

export const PublicSearchRequestSchema = z.object({
  searchKey: z.string().trim().min(1, 'Masukkan kata kunci pencarian.').max(120),
  turnstileToken: z.string().min(1).max(4096).optional(),
});

export const RecoveryVerifyRequestSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  searchKey: z.string().trim().min(1, 'Kunci pencarian wajib diisi.').max(120),
  method: z.enum(['recovery_code', 'email_otp']).default('recovery_code'),
  code: z.string().trim().min(4, 'Kode verifikasi wajib diisi.').max(128),
  turnstileToken: z.string().min(1).max(4096).optional(),
});

export const RecoveryResendOtpSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  searchKey: z.string().trim().min(1).max(120),
  turnstileToken: z.string().min(1).max(4096).optional(),
});

export interface RecoveredDocumentItem {
  publicId: string;
  documentNumber: string;
  documentStatus: string;
  canDownload: boolean;
  issuedAt: string | null;
}

export type VerificationState = 'VALID' | 'REVOKED' | 'NOT_FOUND' | 'UNAVAILABLE';

export interface PublicVerificationResult {
  state: VerificationState;
  documentNumber?: string;
  recipientName?: string;
  eventTitle?: string;
  documentType?: TemplateDocumentType;
  issuedAt?: string | null;
  organizer?: string;
  revisionNumber?: number;
  revokedAt?: string | null;
  revokedReason?: string | null;
}
