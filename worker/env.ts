export interface AdminContextUser {
  id: string;
  username: string;
  displayName: string;
  sessionId: string;
}

export interface WorkerEnv {
  ASSETS?: Fetcher;
  DB?: D1Database;
  FLYER_BUCKET?: R2Bucket;
  APP_NAME?: string;
  APP_BASE_URL?: string;
  APP_ENV?: string;
  APP_TIMEZONE?: string;
  ORGANIZATION_NAME?: string;
  ORGANIZATION_CODE?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  GAS_WEB_APP_URL?: string;
  GAS_SHARED_SECRET?: string;
  DATA_ENCRYPTION_KEY?: string;
  LOOKUP_HMAC_KEY?: string;
}

export interface AppVariables {
  requestId: string;
  admin?: AdminContextUser;
}

export interface AppEnv {
  Bindings: WorkerEnv;
  Variables: AppVariables;
}
