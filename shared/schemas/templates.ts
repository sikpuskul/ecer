import { z } from 'zod';

export const TEMPLATE_DOCUMENT_TYPES = ['certificate', 'award'] as const;
export type TemplateDocumentType = (typeof TEMPLATE_DOCUMENT_TYPES)[number];

export const PLACEHOLDER_SOURCES = [
  'participant_input',
  'event_data',
  'admin_input',
  'static_value',
  'system_generated',
  'document_number',
  'verification_qr',
] as const;
export type PlaceholderSource = (typeof PLACEHOLDER_SOURCES)[number];

export const TEMPLATE_VALIDATION_STATUSES = ['pending', 'valid', 'warning', 'invalid'] as const;
export type TemplateValidationStatus = (typeof TEMPLATE_VALIDATION_STATUSES)[number];

export const PLACEHOLDER_NAME_REGEX = /^[a-z][a-z0-9_]{0,63}$/;

/**
 * Extracts Google Docs document ID strictly from valid docs.google.com URLs (PRD §10.2).
 * Rejects arbitrary URLs to prevent SSRF or misuse.
 */
export function extractGoogleDocIdFromUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'docs.google.com') {
      return null;
    }
    const match = /^\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{15,100})(?:\/|$)/.exec(
      parsed.pathname,
    );
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export const PlaceholderMappingEntrySchema = z.object({
  placeholder: z.string().regex(PLACEHOLDER_NAME_REGEX),
  source: z.enum(PLACEHOLDER_SOURCES),
  sourceKey: z.string().max(100).optional(),
  staticValue: z.string().max(500).optional(),
  transform: z.enum(['none', 'uppercase', 'titlecase']).optional().default('none'),
});

export type PlaceholderMappingEntry = z.infer<typeof PlaceholderMappingEntrySchema>;

export const ImportTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Nama template minimal 3 karakter.')
    .max(150, 'Nama template maksimal 150 karakter.'),
  description: z.string().max(1000).optional().default(''),
  documentType: z.enum(TEMPLATE_DOCUMENT_TYPES),
  googleDocsUrl: z
    .string()
    .trim()
    .url('Masukkan URL Google Docs yang valid.')
    .refine((val) => extractGoogleDocIdFromUrl(val) !== null, {
      message:
        'Hanya URL Google Docs resmi (https://docs.google.com/document/d/...) yang diizinkan.',
    }),
});

export type ImportTemplateInput = z.infer<typeof ImportTemplateSchema>;

export const UpdateTemplateSchema = z.object({
  name: z.string().trim().min(3).max(150).optional(),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
  mappings: z.array(PlaceholderMappingEntrySchema).optional(),
});

export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;

export interface TemplateVersionItem {
  id: string;
  templateId: string;
  versionNumber: number;
  snapshotDocId: string | null;
  placeholders: string[];
  mappings: PlaceholderMappingEntry[];
  validationStatus: TemplateValidationStatus;
  createdAt: string;
}

export interface TemplateItem {
  id: string;
  name: string;
  description: string;
  documentType: TemplateDocumentType;
  googleDocId: string;
  isActive: boolean;
  latestVersion: TemplateVersionItem | null;
  createdAt: string;
  updatedAt: string;
}

export function buildDefaultMappings(placeholders: string[]): PlaceholderMappingEntry[] {
  return placeholders.map((ph): PlaceholderMappingEntry => {
    if (ph === 'qr_code') {
      return { placeholder: ph, source: 'verification_qr', transform: 'none' };
    }
    if (ph === 'nomor_sertifikat' || ph === 'nomor_piagam' || ph === 'nomor_dokumen') {
      return { placeholder: ph, source: 'document_number', transform: 'none' };
    }
    if (ph === 'tanggal_terbit') {
      return {
        placeholder: ph,
        source: 'system_generated',
        sourceKey: 'issued_date',
        transform: 'none',
      };
    }
    if (
      ph === 'nama_kegiatan' ||
      ph === 'tanggal_kegiatan' ||
      ph === 'lokasi_kegiatan' ||
      ph === 'penyelenggara'
    ) {
      return { placeholder: ph, source: 'event_data', sourceKey: ph, transform: 'none' };
    }
    if (ph === 'nama_kepala_puskesmas' || ph === 'nip_kepala_puskesmas') {
      return { placeholder: ph, source: 'static_value', staticValue: '', transform: 'none' };
    }
    return { placeholder: ph, source: 'participant_input', sourceKey: ph, transform: 'none' };
  });
}
