import { Hono } from 'hono';
import { ERROR_CODES } from '../../../shared/constants/api';
import type { AppEnv } from '../../env';
import {
  GasIntegrationError,
  GoogleAppsScriptClient,
} from '../../integrations/google-apps-script/client';
import { requireAdminAuth } from '../../middleware/auth';
import { AppError } from '../../middleware/error-handler';

export function createIntegrationRoutes() {
  const integration = new Hono<AppEnv>();

  integration.use('*', requireAdminAuth);

  integration.get('/gas-health', async (c) => {
    const requestId = c.get('requestId');
    const webAppUrl = c.env.GAS_WEB_APP_URL;
    const sharedSecret = c.env.GAS_SHARED_SECRET;

    if (!webAppUrl || !sharedSecret) {
      throw new AppError(
        ERROR_CODES.INTEGRATION_UNAVAILABLE,
        'Konfigurasi integrasi Google Apps Script belum lengkap.',
        503,
      );
    }

    try {
      const client = new GoogleAppsScriptClient({
        webAppUrl,
        sharedSecret,
        maxRetries: 1,
      });
      const result = await client.health(requestId);
      c.header('Cache-Control', 'no-store');
      return c.json(
        {
          success: true as const,
          data: result,
          requestId,
        },
        200,
      );
    } catch (error) {
      if (error instanceof GasIntegrationError) {
        throw new AppError(ERROR_CODES.INTEGRATION_UNAVAILABLE, error.message, 503);
      }
      throw new AppError(
        ERROR_CODES.INTEGRATION_UNAVAILABLE,
        'Gagal menghubungi layanan Google Apps Script.',
        503,
      );
    }
  });

  return integration;
}
