export const GAS_PROTOCOL_VERSION = '1' as const;

export const GAS_ALLOWED_ACTIONS = [
  'health',
  'inspect_template',
  'snapshot_template',
  'generate_document',
  'get_generation_result',
  'fetch_pdf',
  'send_email',
  'get_email_quota',
  'delete_managed_file',
] as const;

export type GasAction = (typeof GAS_ALLOWED_ACTIONS)[number];

export interface GasRequestEnvelope<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  version: typeof GAS_PROTOCOL_VERSION;
  action: GasAction;
  timestamp: number;
  nonce: string;
  requestId: string;
  payload: TPayload;
  signature: string;
}

export interface GasSuccessResponse<TData = unknown> {
  success: true;
  requestId: string;
  data: TData;
}

export interface GasErrorResponse {
  success: false;
  requestId: string;
  error: {
    code: string;
    message: string;
  };
}

export type GasResponseEnvelope<TData = unknown> = GasSuccessResponse<TData> | GasErrorResponse;

export interface GasClientConfig {
  webAppUrl: string;
  sharedSecret: string;
  timeoutMs?: number;
  maxRetries?: number;
  maxPdfBytes?: number;
  fetchImpl?: typeof fetch;
}
