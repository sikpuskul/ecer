import { Hono } from 'hono';
import { API_BASE_PATH } from '../shared/constants/api';
import type { HealthResponse } from '../shared/schemas/health';
import type { AppEnv } from './env';
import { apiNotFoundHandler, errorHandler } from './middleware/error-handler';
import { requestIdMiddleware } from './middleware/request-id';
import { securityHeadersMiddleware } from './middleware/security-headers';
import { createAuditRoutes } from './modules/audit/routes';
import { createAuthRoutes } from './modules/auth/routes';
import { createAdminAwardsRoutes } from './modules/awards/routes';
import { createDashboardRoutes } from './modules/dashboard/routes';
import { createAdminDocumentsRoutes, createAdminJobsRoutes } from './modules/documents/routes';
import { createAdminEmailRoutes } from './modules/email/routes';
import { createEventsRoutes } from './modules/events/routes';
import { createEventFormsRoutes } from './modules/forms/routes';
import { createIntegrationRoutes } from './modules/integration/routes';
import { createNumberingRoutes } from './modules/numbering/routes';
import { createAdminParticipantsRoutes } from './modules/participants/routes';
import { createPublicRoutes } from './modules/public/routes';
import { createRecoveryRoutes } from './modules/recovery/routes';
import { createAdminReportsRoutes } from './modules/reports/routes';
import { createCategoriesRoutes, createSettingsRoutes } from './modules/settings/routes';
import { createAdminStorageRoutes, createPublicAssetRoutes } from './modules/storage/routes';
import { createTemplatesRoutes } from './modules/templates/routes';
import { createUsersRoutes } from './modules/users/routes';
import { createVerificationRoutes } from './modules/verification/routes';

export const APP_VERSION = '0.10.0';

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

  api.get('/public/config', (c) => {
    const requestId = c.get('requestId');
    c.header('Cache-Control', 'public, max-age=60');
    return c.json(
      {
        success: true as const,
        data: {
          appName: c.env.APP_NAME ?? 'ECER',
          organizationName: c.env.ORGANIZATION_NAME ?? 'Puskesmas Sumbermanjing Kulon',
          timezone: c.env.APP_TIMEZONE ?? 'Asia/Jakarta',
          turnstileSiteKey: c.env.TURNSTILE_SITE_KEY ?? null,
        },
        requestId,
      },
      200,
    );
  });

  api.route('/public/assets', createPublicAssetRoutes());
  api.route('/public/verify', createVerificationRoutes());
  api.route('/public', createPublicRoutes());
  api.route('/public', createRecoveryRoutes());
  api.route('/auth', createAuthRoutes());
  api.route('/admin/dashboard', createDashboardRoutes());
  api.route('/admin/events', createEventsRoutes());
  api.route('/admin/events', createEventFormsRoutes());
  api.route('/admin', createAdminParticipantsRoutes());
  api.route('/admin/templates', createTemplatesRoutes());
  api.route('/admin/numbering', createNumberingRoutes());
  api.route('/admin/documents', createAdminDocumentsRoutes());
  api.route('/admin/awards', createAdminAwardsRoutes());
  api.route('/admin/jobs', createAdminJobsRoutes());
  api.route('/admin', createAdminEmailRoutes());
  api.route('/admin/storage', createAdminStorageRoutes());
  api.route('/admin/users', createUsersRoutes());
  api.route('/admin/settings', createSettingsRoutes());
  api.route('/admin/categories', createCategoriesRoutes());
  api.route('/admin/audit-logs', createAuditRoutes());
  api.route('/admin/reports', createAdminReportsRoutes());
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
