import { z } from 'zod';
import type {
  AttendanceMode,
  EventComputedEligibility,
  EventLifecycleStatus,
  IssuanceMode,
} from './events';
import type { FormField } from './forms';

export const SUBMISSION_STATUSES = [
  'submitted',
  'pending_review',
  'approved',
  'rejected',
  'cancelled',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export interface PublicDashboardStats {
  month: number;
  year: number;
  publishedEvents: number;
  activeEvents: number;
  certificatesIssued: number;
  categories: Array<{ id: string; name: string; slug: string }>;
}

export interface PublicEventCard {
  id: string;
  slug: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  organizer: string;
  location: string;
  flyerUrl: string | null;
  eventStartAt: string;
  eventEndAt: string;
  registrationStartAt: string | null;
  registrationEndAt: string | null;
  downloadStartAt: string | null;
  downloadEndAt: string | null;
  quota: number | null;
  participantCount: number;
  attendanceMode: AttendanceMode;
  issuanceMode: IssuanceMode;
  lifecycleStatus: Exclude<EventLifecycleStatus, 'draft'>;
  searchKeyField: string;
  eligibility: EventComputedEligibility;
}

export interface PublicEventFormResponse {
  event: PublicEventCard;
  formVersionId: string | null;
  fields: FormField[];
  privacyNoticeVersion: string;
}

export const PublicRegisterRequestSchema = z.object({
  attendancePin: z.string().trim().max(32).optional(),
  consentAccepted: z.literal(true, {
    errorMap: () => ({
      message: 'Anda wajib menyetujui pemberitahuan privasi sebelum mengirim data.',
    }),
  }),
  turnstileToken: z.string().min(1).max(4096).optional(),
  values: z.record(z.unknown()),
});

export type PublicRegisterRequest = z.infer<typeof PublicRegisterRequestSchema>;

export interface PublicRegisterResponse {
  participantId: string;
  submissionStatus: SubmissionStatus;
  recoveryCode: string;
  message: string;
}

export interface AdminParticipantItem {
  id: string;
  eventId: string;
  formVersionId: string;
  submissionStatus: SubmissionStatus;
  data: Record<string, unknown>;
  email: string | null;
  submittedAt: string;
  approvedAt: string | null;
}

export const AddWhitelistSchema = z.object({
  entries: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(120),
        label: z.string().trim().max(150).optional().default(''),
      }),
    )
    .min(1, 'Minimal 1 data whitelist.')
    .max(200, 'Maksimal 200 baris per batch.'),
});

export type AddWhitelistInput = z.infer<typeof AddWhitelistSchema>;

export interface AdminWhitelistItem {
  id: string;
  label: string;
  usedByParticipantId: string | null;
  createdAt: string;
}
