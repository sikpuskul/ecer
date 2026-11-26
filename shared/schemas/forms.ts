import { z } from 'zod';
import { PLACEHOLDER_NAME_REGEX } from './templates';

export const FORM_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'email',
  'tel',
  'date',
  'select',
  'radio',
  'checkbox',
  'nik',
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const FORM_FIELD_SOURCES = ['participant_input', 'additional'] as const;
export type FormFieldSource = (typeof FORM_FIELD_SOURCES)[number];

export const FormFieldOptionSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(120),
});

export type FormFieldOption = z.infer<typeof FormFieldOptionSchema>;

export const FormFieldSchema = z.object({
  id: z.string().min(1).max(64),
  fieldKey: z
    .string()
    .trim()
    .regex(PLACEHOLDER_NAME_REGEX, 'Field key harus berupa snake_case huruf kecil.'),
  label: z.string().trim().min(1, 'Label field wajib diisi.').max(120),
  inputType: z.enum(FORM_FIELD_TYPES),
  source: z.enum(FORM_FIELD_SOURCES).default('participant_input'),
  description: z.string().max(300).optional().default(''),
  placeholder: z.string().max(120).optional().default(''),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  searchable: z.boolean().default(false),
  sensitive: z.boolean().default(false),
  options: z.array(FormFieldOptionSchema).max(100).optional().default([]),
  defaultValue: z.string().max(200).optional().default(''),
  minLength: z.number().int().min(0).max(1000).nullable().optional(),
  maxLength: z.number().int().min(1).max(2000).nullable().optional(),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  pattern: z.string().max(120).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export type FormField = z.infer<typeof FormFieldSchema>;

export const SaveEventFormSchema = z.object({
  fields: z
    .array(FormFieldSchema)
    .min(1, 'Formulir minimal memiliki 1 field.')
    .max(50, 'Maksimal 50 field per formulir.')
    .refine(
      (fields) => {
        const keys = fields.map((f) => f.fieldKey);
        return new Set(keys).size === keys.length;
      },
      { message: 'Setiap field harus memiliki fieldKey yang unik.' },
    ),
});

export type SaveEventFormInput = z.infer<typeof SaveEventFormSchema>;

export interface FormVersionItem {
  id: string;
  eventId: string;
  versionNumber: number;
  fields: FormField[];
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
}

export const LinkEventTemplatesSchema = z.object({
  templates: z
    .array(
      z.object({
        templateVersionId: z.string().min(1),
        numberingRuleId: z.string().min(1).optional(),
        categoryName: z.string().trim().min(1).max(80),
        sortOrder: z.number().int().min(0).default(0),
        isActive: z.boolean().default(true),
      }),
    )
    .max(20),
});

export type LinkEventTemplatesInput = z.infer<typeof LinkEventTemplatesSchema>;
