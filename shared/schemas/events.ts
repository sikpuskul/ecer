import { z } from 'zod';

export const EVENT_LIFECYCLE_STATUSES = ['draft', 'published', 'closed', 'archived'] as const;
export type EventLifecycleStatus = (typeof EVENT_LIFECYCLE_STATUSES)[number];

export const ATTENDANCE_MODES = ['open', 'pin', 'whitelist'] as const;
export type AttendanceMode = (typeof ATTENDANCE_MODES)[number];

export const ISSUANCE_MODES = ['auto', 'manual_approval'] as const;
export type IssuanceMode = (typeof ISSUANCE_MODES)[number];

export const COMPUTED_EVENT_STATES = [
  'draft',
  'upcoming',
  'active',
  'registration_closed',
  'quota_full',
  'closed',
  'archived',
] as const;
export type ComputedEventState = (typeof COMPUTED_EVENT_STATES)[number];

export const EventEmailConfigSchema = z.object({
  autoSend: z.boolean().default(true),
  embargoUntilDownloadStart: z.boolean().default(false),
  subject: z.string().max(200).default('Sertifikat Kegiatan - {{nama_kegiatan}}'),
  body: z
    .string()
    .max(4000)
    .default(
      'Yth. {{nama_lengkap}},\n\nTerima kasih telah mengikuti kegiatan {{nama_kegiatan}} yang diselenggarakan oleh Puskesmas Sumbermanjing Kulon.\n\nSertifikat Anda terlampir dalam email ini.\n\nTerima kasih.\nPuskesmas Sumbermanjing Kulon',
    ),
});

export type EventEmailConfig = z.infer<typeof EventEmailConfigSchema>;

export const EventRetentionConfigSchema = z.object({
  participantMonths: z.number().int().min(1).max(120).default(24),
  pdfMonths: z.number().int().min(1).max(120).default(24),
  supersededDays: z.number().int().min(1).max(365).default(90),
});

export type EventRetentionConfig = z.infer<typeof EventRetentionConfigSchema>;

const NullableIsoSchema = z.string().datetime({ offset: true }).nullable().optional();

export const CreateEventSchema = z.object({
  categoryId: z.string().min(1, 'Kategori kegiatan wajib dipilih.'),
  title: z
    .string()
    .trim()
    .min(3, 'Judul kegiatan minimal 3 karakter.')
    .max(200, 'Judul kegiatan maksimal 200 karakter.'),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung.')
    .optional(),
  eventCode: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/, 'Kode kegiatan hanya boleh huruf kapital, angka, _ atau -.')
    .optional(),
  description: z.string().max(4000).optional().default(''),
  organizer: z.string().trim().min(2).max(150).optional().default('Puskesmas Sumbermanjing Kulon'),
  location: z.string().trim().max(200).optional().default(''),
  flyerKey: z.string().max(300).nullable().optional(),
  eventStartAt: z.string().datetime({ offset: true }),
  eventEndAt: z.string().datetime({ offset: true }),
  registrationStartAt: NullableIsoSchema,
  registrationEndAt: NullableIsoSchema,
  downloadStartAt: NullableIsoSchema,
  downloadEndAt: NullableIsoSchema,
  emailReleaseAt: NullableIsoSchema,
  quota: z.number().int().min(1).max(10_000).nullable().optional(),
  attendanceMode: z.enum(ATTENDANCE_MODES).optional().default('open'),
  issuanceMode: z.enum(ISSUANCE_MODES).optional().default('auto'),
  uniqueKeyField: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((v) => v.toLowerCase())
    .optional()
    .default('nomor_peserta'),
  searchKeyField: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((v) => v.toLowerCase())
    .optional()
    .default('nomor_peserta'),
  eventPin: z.string().trim().min(4, 'PIN kegiatan minimal 4 karakter.').max(32).optional(),
  emailConfig: EventEmailConfigSchema.partial().optional(),
  retentionConfig: EventRetentionConfigSchema.partial().optional(),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = CreateEventSchema.partial().extend({
  clearEventPin: z.boolean().optional(),
});

export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

export interface PublishCheckItem {
  key: string;
  label: string;
  passed: boolean;
  message?: string;
}

export interface EventComputedEligibility {
  computedState: ComputedEventState;
  canRegister: boolean;
  canDownload: boolean;
}

export interface AdminEventItem {
  id: string;
  categoryId: string;
  categoryName: string;
  slug: string;
  eventCode: string;
  title: string;
  description: string;
  organizer: string;
  location: string;
  flyerKey: string | null;
  flyerUrl: string | null;
  eventStartAt: string;
  eventEndAt: string;
  publishAt: string | null;
  registrationStartAt: string | null;
  registrationEndAt: string | null;
  downloadStartAt: string | null;
  downloadEndAt: string | null;
  emailReleaseAt: string | null;
  quota: number | null;
  participantCount: number;
  attendanceMode: AttendanceMode;
  issuanceMode: IssuanceMode;
  lifecycleStatus: EventLifecycleStatus;
  uniqueKeyField: string;
  searchKeyField: string;
  hasEventPin: boolean;
  emailConfig: EventEmailConfig;
  retentionConfig: EventRetentionConfig;
  eligibility: EventComputedEligibility;
  publishChecklist?: PublishCheckItem[];
  createdAt: string;
  updatedAt: string;
}
