import { z } from 'zod';

export const EMAIL_JOB_STATUSES = [
  'queued',
  'processing',
  'sent',
  'failed',
  'deferred_quota',
  'retry_wait',
  'needs_review',
  'cancelled',
] as const;
export type EmailJobStatus = (typeof EMAIL_JOB_STATUSES)[number];

export const ResendDocumentEmailSchema = z.object({
  overrideSubject: z.string().trim().min(3).max(200).optional(),
  overrideBody: z.string().trim().min(5).max(4000).optional(),
});

export interface EmailJobItem {
  id: string;
  documentId: string;
  documentNumber: string;
  eventTitle: string;
  maskedEmail: string;
  subject: string;
  jobStatus: EmailJobStatus;
  attempts: number;
  nextAttemptAt: string | null;
  sentAt: string | null;
  errorCode: string | null;
  safeErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailJobsSummary {
  queued: number;
  processing: number;
  sent: number;
  failed: number;
  deferredQuota: number;
  retryWait: number;
  needsReview: number;
  cancelled: number;
  remainingDailyQuota: number | null;
  quotaCheckedAt: string | null;
}
