import { z } from 'zod';

export const ApiErrorBodySchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
  requestId: z.string().min(1),
});

export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

export const HealthDataSchema = z.object({
  status: z.literal('ok'),
  service: z.string().min(1),
  version: z.string().min(1),
  environment: z.string().min(1),
  timezone: z.string().min(1),
  timestamp: z.string().datetime(),
});

export type HealthData = z.infer<typeof HealthDataSchema>;

export const HealthResponseSchema = z.object({
  success: z.literal(true),
  data: HealthDataSchema,
  requestId: z.string().min(1),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
