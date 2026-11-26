const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyParams {
  secretKey: string | undefined;
  token: string | undefined;
  remoteIp?: string | null;
  appEnv?: string;
}

export interface TurnstileVerifyResult {
  ok: boolean;
  bypassed?: boolean;
}

export async function verifyTurnstileToken(
  params: TurnstileVerifyParams,
): Promise<TurnstileVerifyResult> {
  const { secretKey, token, remoteIp, appEnv } = params;

  if (!secretKey) {
    if (appEnv === 'development' || appEnv === 'test') {
      return { ok: true, bypassed: true };
    }
    return { ok: false };
  }

  if (!token) {
    return { ok: false };
  }

  const formData = new URLSearchParams();
  formData.set('secret', secretKey);
  formData.set('response', token);
  if (remoteIp) {
    formData.set('remoteip', remoteIp);
  }

  try {
    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      return { ok: false };
    }

    const body = (await response.json()) as { success?: boolean };
    return { ok: body.success === true };
  } catch {
    return { ok: false };
  }
}
