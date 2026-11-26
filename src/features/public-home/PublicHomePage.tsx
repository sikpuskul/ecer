import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, LogIn, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import type { HealthResponse } from '@shared/schemas/health';
import { fetchHealth } from '@/lib/api-client';

type HealthState =
  | { status: 'loading' }
  | { status: 'ready'; payload: HealthResponse }
  | { status: 'error'; message: string };

function formatJakartaTimestamp(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export function PublicHomePage() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });

  const checkBackend = useCallback(async (signal?: AbortSignal) => {
    setHealth({ status: 'loading' });
    try {
      const payload = await fetchHealth(signal);
      setHealth({ status: 'ready', payload });
    } catch (error) {
      if (signal?.aborted) {
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Tidak dapat terhubung ke layanan backend ECER.';
      setHealth({ status: 'error', message });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void checkBackend(controller.signal);
    return () => controller.abort();
  }, [checkBackend]);

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-forest)] text-[var(--color-surface)]"
              aria-hidden="true"
            >
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold leading-tight tracking-tight text-[var(--color-primary-forest)]">
                ECER
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Puskesmas Sumbermanjing Kulon
              </p>
            </div>
          </div>

          <Link
            to="/admin/login"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-primary-forest)] transition-colors hover:bg-[var(--color-canvas)]"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            <span>Login Admin</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-primary-forest)] sm:text-3xl">
            Sertifikat dan Piagam Digital
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
            Layanan penerbitan, pencarian, pengunduhan mandiri, dan verifikasi sertifikat kegiatan
            Puskesmas Sumbermanjing Kulon. Dashboard kegiatan publik akan hadir pada tahap
            berikutnya.
          </p>
        </section>

        <section
          aria-labelledby="health-heading"
          className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6"
        >
          <div className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="health-heading"
                className="text-lg font-semibold text-[var(--color-text-primary)]"
              >
                Status Kesehatan Layanan
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Pemeriksaan langsung ke endpoint{' '}
                <code className="rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs text-[var(--color-primary-forest)]">
                  GET /api/v1/health
                </code>
              </p>
            </div>

            <button
              type="button"
              onClick={() => void checkBackend()}
              disabled={health.status === 'loading'}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 py-2.5 text-sm font-semibold text-[var(--color-surface)] transition-colors duration-200 hover:bg-[var(--color-primary-forest)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${health.status === 'loading' ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{health.status === 'loading' ? 'Memeriksa...' : 'Periksa Ulang'}</span>
            </button>
          </div>

          <div className="mt-5" role="status" aria-live="polite">
            {health.status === 'loading' && (
              <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary-green)]" />
                <span>Menghubungi layanan API ECER...</span>
              </div>
            )}

            {health.status === 'error' && (
              <div
                role="alert"
                className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger-bg)] p-4 text-sm text-[var(--color-danger)]"
              >
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Koneksi API belum tersedia</span>
                </div>
                <p className="text-[13px] leading-relaxed">{health.message}</p>
              </div>
            )}

            {health.status === 'ready' && (
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-success-bg)] px-3 py-1 text-xs font-semibold text-[var(--color-success)]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Frontend &amp; Backend Terhubung</span>
                </div>

                <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-[var(--color-border)] pt-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs font-medium text-[var(--color-text-secondary)]">
                      Layanan
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                      {health.payload.data.service}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium text-[var(--color-text-secondary)]">
                      Versi &amp; Environment
                    </dt>
                    <dd className="tabular-nums mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                      v{health.payload.data.version} · {health.payload.data.environment}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium text-[var(--color-text-secondary)]">
                      Waktu Server (WIB)
                    </dt>
                    <dd className="tabular-nums mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                      {formatJakartaTimestamp(health.payload.data.timestamp)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium text-[var(--color-text-secondary)]">
                      Request ID
                    </dt>
                    <dd className="tabular-nums mt-1 truncate font-mono text-xs text-[var(--color-text-secondary)]">
                      {health.payload.requestId}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
