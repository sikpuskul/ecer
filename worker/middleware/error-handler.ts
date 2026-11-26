import type { ErrorHandler, NotFoundHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ERROR_CODES, type ErrorCode } from '../../shared/constants/api';
import type { AppEnv } from '../env';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: ContentfulStatusCode;

  constructor(code: ErrorCode, message: string, status: ContentfulStatusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId') ?? crypto.randomUUID();
  c.header('X-Request-Id', requestId);

  if (err instanceof AppError) {
    return c.json(
      {
        success: false as const,
        error: {
          code: err.code,
          message: err.message,
        },
        requestId,
      },
      err.status,
    );
  }

  console.error(
    JSON.stringify({
      level: 'error',
      event: 'unhandled_worker_error',
      requestId,
      errorName: err instanceof Error ? err.name : 'UnknownError',
    }),
  );

  return c.json(
    {
      success: false as const,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Terjadi kesalahan pada server. Silakan coba kembali.',
      },
      requestId,
    },
    500,
  );
};

export const apiNotFoundHandler: NotFoundHandler<AppEnv> = (c) => {
  const requestId = c.get('requestId') ?? crypto.randomUUID();
  c.header('X-Request-Id', requestId);

  return c.json(
    {
      success: false as const,
      error: {
        code: ERROR_CODES.NOT_FOUND,
        message: 'Endpoint API tidak ditemukan.',
      },
      requestId,
    },
    404,
  );
};
