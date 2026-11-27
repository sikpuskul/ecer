import { z } from 'zod';
import type { TemplateDocumentType } from './templates';

export const DOCUMENT_STATUSES = ['queued', 'processing', 'ready', 'failed', 'revoked'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const GENERATION_JOB_STATUSES = [
  'queued',
  'processing',
  'retry_wait',
  'succeeded',
  'failed',
  'cancelled',
  'needs_review',
] as const;
export type GenerationJobStatus = (typeof GENERATION_JOB_STATUSES)[number];

export const RevokeDocumentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Alasan pencabutan minimal 5 karakter.')
    .max(500, 'Alasan pencabutan maksimal 500 karakter.'),
});

export interface AdminDocumentItem {
  id: string;
  publicId: string;
  eventId: string;
  eventTitle: string;
  participantId: string | null;
  documentType: TemplateDocumentType;
  documentNumber: string;
  verificationCode: string;
  recipientName: string;
  documentStatus: DocumentStatus;
  revisionCount: number;
  issuedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
}

export interface DocumentRevisionItem {
  id: string;
  documentId: string;
  revisionNumber: number;
  filename: string;
  fileSize: number;
  revisionStatus: string;
  createdAt: string;
}

export interface GenerationJobItem {
  id: string;
  documentId: string;
  documentNumber: string;
  revisionNumber: number;
  jobStatus: GenerationJobStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  errorCode: string | null;
  safeErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
