import { z } from 'zod';
import { GAS_ALLOWED_ACTIONS, GAS_PROTOCOL_VERSION } from './types';

export const GasActionSchema = z.enum(GAS_ALLOWED_ACTIONS);

export const GasRequestEnvelopeSchema = z.object({
  version: z.literal(GAS_PROTOCOL_VERSION),
  action: GasActionSchema,
  timestamp: z.number().int().positive(),
  nonce: z.string().min(16).max(128),
  requestId: z.string().min(8).max(64),
  payload: z.record(z.unknown()),
  signature: z.string().regex(/^[0-9a-f]{64}$/),
});

export function createGasResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.discriminatedUnion('success', [
    z.object({
      success: z.literal(true),
      requestId: z.string().min(1),
      data: dataSchema,
    }),
    z.object({
      success: z.literal(false),
      requestId: z.string().min(1),
      error: z.object({
        code: z.string().min(1),
        message: z.string().min(1),
      }),
    }),
  ]);
}

export const GasHealthDataSchema = z.object({
  status: z.literal('ok'),
  environment: z.string().min(1),
  remainingEmailQuota: z.number().int().nonnegative(),
  timestamp: z.string().min(1),
});

export const GasInspectTemplateDataSchema = z.object({
  googleDocId: z.string().min(1),
  title: z.string().min(1),
  placeholders: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const GasSnapshotTemplateDataSchema = z.object({
  sourceDocId: z.string().min(1),
  snapshotDocId: z.string().min(1),
  snapshotName: z.string().min(1),
});

export const GasGenerateDocumentDataSchema = z.object({
  jobId: z.string().min(1),
  driveFileId: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.literal('application/pdf'),
  fileSize: z.number().int().nonnegative(),
  checksum: z.string().min(1).optional(),
  reusedFromRegistry: z.boolean().optional(),
});

export const GasFetchPdfDataSchema = z.object({
  driveFileId: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.literal('application/pdf'),
  fileSize: z.number().int().nonnegative(),
  contentBase64: z.string().min(1),
});

export const GasEmailQuotaDataSchema = z.object({
  remainingDailyQuota: z.number().int().nonnegative(),
  checkedAt: z.string().min(1),
});

export const GasSendEmailDataSchema = z.object({
  jobId: z.string().min(1),
  accepted: z.boolean(),
  remainingDailyQuota: z.number().int().nonnegative(),
  sentAt: z.string().min(1),
});

export const GasDeleteFileDataSchema = z.object({
  driveFileId: z.string().min(1),
  deleted: z.boolean(),
});
