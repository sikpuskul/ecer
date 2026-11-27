import { z } from 'zod';
import type { DocumentStatus } from './documents';

export const AWARD_BULK_MAX_ROWS = 100;

export const DEFAULT_AWARD_CATEGORIES = [
  'Narasumber',
  'Moderator',
  'Panitia',
  'Peserta Terbaik',
  'Juara 1',
  'Juara 2',
  'Juara 3',
  'Kontributor',
] as const;

export const BulkAwardRowSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(2, 'Nama penerima minimal 2 karakter.')
    .max(160, 'Nama penerima maksimal 160 karakter.'),
  awardCategory: z
    .string()
    .trim()
    .min(2, 'Kategori penghargaan minimal 2 karakter.')
    .max(120, 'Kategori penghargaan maksimal 120 karakter.'),
  institution: z.string().trim().max(160).optional().default(''),
  email: z.string().trim().email('Format email tidak valid.').max(160).optional().or(z.literal('')),
  notes: z.string().trim().max(300).optional().default(''),
});

export type BulkAwardRow = z.infer<typeof BulkAwardRowSchema>;

export const CreateManualAwardSchema = BulkAwardRowSchema.extend({
  eventId: z.string().min(1, 'Kegiatan wajib dipilih.'),
  eventTemplateId: z.string().min(1, 'Template piagam wajib dipilih.'),
});

export type CreateManualAwardInput = z.infer<typeof CreateManualAwardSchema>;

export const BulkImportAwardsSchema = z.object({
  eventId: z.string().min(1, 'Kegiatan wajib dipilih.'),
  eventTemplateId: z.string().min(1, 'Template piagam wajib dipilih.'),
  rows: z
    .array(BulkAwardRowSchema)
    .min(1, 'Minimal 1 baris data penerima.')
    .max(AWARD_BULK_MAX_ROWS, `Maksimal ${AWARD_BULK_MAX_ROWS} baris per batch import.`),
});

export type BulkImportAwardsInput = z.infer<typeof BulkImportAwardsSchema>;

export const ImportAwardsFromParticipantsSchema = z.object({
  eventId: z.string().min(1, 'Kegiatan wajib dipilih.'),
  eventTemplateId: z.string().min(1, 'Template piagam wajib dipilih.'),
  participantIds: z
    .array(z.string().min(1))
    .min(1, 'Pilih minimal 1 peserta.')
    .max(AWARD_BULK_MAX_ROWS, `Maksimal ${AWARD_BULK_MAX_ROWS} peserta per batch.`),
  awardCategory: z.string().trim().min(2, 'Kategori penghargaan wajib diisi.').max(120),
  notes: z.string().trim().max(300).optional().default(''),
});

export type ImportAwardsFromParticipantsInput = z.infer<typeof ImportAwardsFromParticipantsSchema>;

export interface AwardTemplateOption {
  eventTemplateId: string;
  eventId: string;
  eventTitle: string;
  eventCode: string;
  templateName: string;
  templateVersionId: string;
  numberingRuleId: string;
}

export interface AdminAwardItem {
  id: string;
  publicId: string;
  eventId: string;
  eventTitle: string;
  documentNumber: string;
  verificationCode: string;
  recipientName: string;
  awardCategory: string;
  institution: string;
  documentStatus: DocumentStatus;
  issuedAt: string | null;
  revokedAt: string | null;
  revisionCount: number;
  createdAt: string;
}
