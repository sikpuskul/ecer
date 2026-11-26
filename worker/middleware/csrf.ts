import type { MiddlewareHandler } from 'hono';
import { ERROR_CODES } from '../../shared/constants/api';
import type { AppEnv } from '../env';
import { AppError } from './error-handler';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function extractOrigin(urlValue: string | undefined): string | null {
  if (!urlValue) {
    return null;
  }
  try {
    return new URL(urlValue).origin;
  } catch {
    return null;
  }
}

export const csrfOriginMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method.toUpperCase())) {
    await next();
    return;
  }

  const allowedOrigins = new Set<string>();
  const requestOrigin = extractOrigin(c.req.url);
  if (requestOrigin) {
    allowedOrigins.add(requestOrigin);
  }
  const configuredOrigin = extractOrigin(c.env.APP_BASE_URL);
  if (configuredOrigin) {
    allowedOrigins.add(configuredOrigin);
  }

  const headerOrigin = c.req.header('origin');
  const headerReferer = c.req.header('referer');
  const candidateOrigin = headerOrigin ?? extractOrigin(headerReferer);

  if (!candidateOrigin || !allowedOrigins.has(candidateOrigin)) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      'Permintaan ditolak karena origin tidak diizinkan.',
      403,
    );
  }

  await next();
};
