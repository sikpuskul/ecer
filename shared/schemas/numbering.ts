import { z } from 'zod';
import { TEMPLATE_DOCUMENT_TYPES, type TemplateDocumentType } from './templates';

export const RESET_STRATEGIES = ['never', 'monthly', 'yearly', 'per_event'] as const;
export type ResetStrategy = (typeof RESET_STRATEGIES)[number];

export const CreateNumberingRuleSchema = z.object({
  name: z.string().trim().min(2, 'Nama aturan minimal 2 karakter.').max(120),
  documentType: z.enum(TEMPLATE_DOCUMENT_TYPES),
  formatPattern: z
    .string()
    .trim()
    .min(3, 'Pola penomoran wajib diisi.')
    .max(150)
    .refine((val) => val.includes('{SEQ}'), {
      message: 'Pola penomoran wajib menyertakan token {SEQ}.',
    }),
  sequencePadding: z.number().int().min(1).max(8).default(3),
  startingNumber: z.number().int().min(1).max(1_000_000).default(1),
  resetStrategy: z.enum(RESET_STRATEGIES).default('yearly'),
  organizationCode: z.string().trim().min(2).max(32).default('PKM-SMK'),
});

export type CreateNumberingRuleInput = z.infer<typeof CreateNumberingRuleSchema>;

export const UpdateNumberingRuleSchema = CreateNumberingRuleSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateNumberingRuleInput = z.infer<typeof UpdateNumberingRuleSchema>;

export const PreviewNumberingSchema = z.object({
  formatPattern: z.string().trim().min(3).max(150),
  sequencePadding: z.number().int().min(1).max(8).default(3),
  sequenceNumber: z.number().int().min(1).default(1),
  documentType: z.enum(TEMPLATE_DOCUMENT_TYPES).default('certificate'),
  eventCode: z.string().trim().max(32).default('KDR-2026'),
  organizationCode: z.string().trim().max(32).default('PKM-SMK'),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
});

export type PreviewNumberingInput = z.infer<typeof PreviewNumberingSchema>;

export interface NumberingRuleItem {
  id: string;
  name: string;
  documentType: TemplateDocumentType;
  formatPattern: string;
  sequencePadding: number;
  startingNumber: number;
  resetStrategy: ResetStrategy;
  organizationCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
