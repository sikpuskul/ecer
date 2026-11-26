import { Hono } from 'hono';
import { API_BASE_PATH } from '../shared/constants/api';
import type { HealthResponse } from '../shared/schemas/health';
import type { AppEnv } from './env';
import { apiNotFoundHandler, errorHandler } from './middleware/error-handler';
import { requestIdMiddleware } from './middleware/request-id';
import { securityHeadersMiddleware } from './middleware/security-headers';
import { createAuthRoutes } from './modules/auth/routes';
import { createIntegrationRoutes } from './modules/integration/routes';

export const APP_VERSION = '0.1.0';

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use('*', requestIdMiddleware);
  app.use('*', securityHeadersMiddleware);
  app.onError(errorHandler);

  const api = new Hono<AppEnv>();

  api.get('/health', (c) => {
    const requestId = c.get('requestId');
    const body: HealthResponse = {
      success: true,
      data: {
        status: 'ok',
        service: 'ecer-api',
        version: APP_VERSION,
        environment: c.env.APP_ENV ?? 'development',
        timezone: c.env.APP_TIMEZONE ?? 'Asia/Jakarta',
        timestamp: new Date().toISOString(),
      },
      requestId,
    };

    c.header('Cache-Control', 'no-store');
    return c.json(body, 200);
  });

  api.route('/auth', createAuthRoutes());
  api.route('/admin/integration', createIntegrationRoutes());

  app.route(API_BASE_PATH, api);
  app.all('/api/*', apiNotFoundHandler);

  app.all('*', async (c) => {
    if (c.env.ASSETS) {
      return c.env.ASSETS.fetch(c.req.raw);
    }
    return c.text('Not Found', 404);
  });

  return app;
}
