import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';

const SAFE_REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

export const requestIdMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const incoming = c.req.header('x-request-id');
  const requestId =
    incoming && SAFE_REQUEST_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();

  c.set('requestId', requestId);
  await next();
  c.header('X-Request-Id', requestId);
};
