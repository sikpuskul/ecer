import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ApiClientError, loginAdminApi } from '@/lib/api-client';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

export function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | undefined>(undefined);

  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const redirectTo = (location.state as { from?: string } | null)?.from?.startsWith('/admin')
    ? (location.state as { from: string }).from
    : '/admin';

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !turnstileContainerRef.current) {
      return;
    }

    let cancelled = false;
    const renderWidget = () => {
      if (cancelled || !turnstileContainerRef.current || !window.turnstile) return;
      if (turnstileWidgetIdRef.current) return;

      turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(undefined),
        'error-callback': () => setTurnstileToken(undefined),
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
      );
      if (existingScript) {
        existingScript.addEventListener('load', renderWidget, { once: true });
      } else {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.addEventListener('load', renderWidget, { once: true });
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (turnstileWidgetIdRef.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = undefined;
      }
    };
  }, []);

  const loginMutation = useMutation({
    mutationFn: loginAdminApi,
    onSuccess: (admin) => {
      queryClient.setQueryData(['auth', 'me'], admin);
      void navigate(redirectTo, { replace: true });
    },
    onError: (err) => {
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'Login gagal. Periksa kembali kredensial Anda.';
      setFormError(message);
      if (turnstileWidgetIdRef.current && window.turnstile) {
        window.turnstile.reset(turnstileWidgetIdRef.current);
        setTurnstileToken(undefined);
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!username.trim() || !password) {
      setFormError('Username dan password wajib diisi.');
      return;
    }

    loginMutation.mutate({
      username: username.trim(),
      password,
      turnstileToken,
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-canvas)] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-forest)] text-[var(--color-surface)]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-bold leading-tight text-[var(--color-primary-forest)]">
                ECER
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Puskesmas Sumbermanjing Kulon
              </p>
            </div>
          </div>

          <Link
            to="/"
            className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary-forest)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Beranda</span>
          </Link>
        </div>

        <main className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-7">
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-primary-forest)]">
            Masuk Administrator
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
            Gunakan akun administrator Puskesmas untuk mengelola kegiatan, sertifikat, dan piagam.
          </p>

          {formError && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger-bg)] p-3.5 text-sm text-[var(--color-danger)]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label
                htmlFor="login-username"
                className="block text-sm font-medium text-[var(--color-text-primary)]"
              >
                Username
              </label>
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1.5 block min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary-green)] focus:outline-none"
                placeholder="Masukkan username"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-[var(--color-text-primary)]"
              >
                Password
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 block min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary-green)] focus:outline-none"
                placeholder="Masukkan password"
              />
            </div>

            {TURNSTILE_SITE_KEY && (
              <div className="pt-1">
                <div ref={turnstileContainerRef} />
              </div>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 py-2.5 text-sm font-semibold text-[var(--color-surface)] transition-colors duration-150 hover:bg-[var(--color-primary-forest)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loginMutation.isPending ? 'Memverifikasi...' : 'Masuk'}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
