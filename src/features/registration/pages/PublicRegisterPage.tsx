import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, CheckCircle2, Copy } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { validateDynamicSubmission } from '@shared/utils/form-validator';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { ApiClientError, fetchPublicConfig } from '@/lib/api-client';
import {
  fetchPublicEventForm,
  registerPublicParticipantApi,
} from '@/features/public-dashboard/api';

export function PublicRegisterPage() {
  const { slug } = useParams();
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [attendancePin, setAttendancePin] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>(undefined);
  const [turnstileResetCount, setTurnstileResetCount] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const configQuery = useQuery({
    queryKey: ['public', 'config'],
    queryFn: fetchPublicConfig,
    staleTime: 5 * 60_000,
  });

  const formQuery = useQuery({
    queryKey: ['public', 'event-form', slug],
    queryFn: () => fetchPublicEventForm(slug!),
    enabled: Boolean(slug),
  });

  const turnstileSiteKey = configQuery.data?.turnstileSiteKey ?? null;

  const registerMutation = useMutation({
    mutationFn: () =>
      registerPublicParticipantApi(slug!, {
        attendancePin: attendancePin.trim() || undefined,
        consentAccepted: true,
        turnstileToken,
        values,
      }),
    onError: (err) => {
      setSubmitError(
        err instanceof ApiClientError
          ? err.message
          : 'Gagal mengirim data. Data yang Anda ketik tetap aman, silakan coba lagi.',
      );
      setTurnstileResetCount((c) => c + 1);
    },
  });

  if (formQuery.isPending) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">Memuat formulir kegiatan...</p>
    );
  }

  if (formQuery.isError || !formQuery.data) {
    return (
      <div className="mx-auto max-w-xl rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <p className="text-base font-semibold text-[var(--color-danger)]">
          Kegiatan tidak ditemukan
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-[var(--color-primary-green)]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Daftar Kegiatan</span>
        </Link>
      </div>
    );
  }

  const { event, fields, privacyNoticeVersion } = formQuery.data;

  if (registerMutation.isSuccess && registerMutation.data) {
    const res = registerMutation.data;
    return (
      <div className="mx-auto max-w-xl rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-success-bg)] px-3 py-1 text-xs font-semibold text-[var(--color-success)]">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span>Pengajuan Berhasil Dikirim</span>
        </div>

        <h1 className="mt-4 text-xl font-bold text-[var(--color-primary-forest)]">{event.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {res.message}
        </p>

        <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-primary-green)]/30 bg-[var(--color-accent-mint)]/50 p-4">
          <p className="text-xs font-semibold text-[var(--color-primary-forest)]">
            Kode Pemulihan Anda (Simpan Baik-Baik — Tidak Ditampilkan Lagi)
          </p>
          <p className="tabular-nums mt-2 break-all font-mono text-sm font-bold text-[var(--color-primary-forest)]">
            {res.recoveryCode}
          </p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(res.recoveryCode);
              setCopied(true);
            }}
            className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-3.5 text-xs font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)]"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{copied ? 'Kode Tersalin' : 'Salin Kode Pemulihan'}</span>
          </button>
        </div>

        <Link
          to="/"
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-[var(--color-primary-green)] hover:text-[var(--color-primary-forest)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Kembali ke Beranda Kegiatan</span>
        </Link>
      </div>
    );
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);

    const check = validateDynamicSubmission(fields, values);
    setFieldErrors(check.errors);
    if (!check.valid) {
      setSubmitError('Mohon periksa kembali isian yang ditandai merah.');
      return;
    }

    if (event.attendanceMode === 'pin' && !attendancePin.trim()) {
      setSubmitError('Masukkan PIN kehadiran yang diberikan panitia.');
      return;
    }

    if (!consentAccepted) {
      setSubmitError('Anda wajib menyetujui pemberitahuan privasi sebelum mengirim data.');
      return;
    }

    registerMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary-forest)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Kembali ke Daftar Kegiatan</span>
      </Link>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-7">
        <h1 className="text-xl font-bold text-[var(--color-primary-forest)]">{event.title}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Isi data dengan teliti sesuai penulisan yang diinginkan pada sertifikat. Data tidak dapat
          diubah sendiri setelah dikirim.
        </p>

        {!event.eligibility.canRegister ? (
          <div
            role="alert"
            className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-warning)]/30 bg-[var(--color-warning-bg)] p-4 text-sm text-[var(--color-warning)]"
          >
            Periode pengisian sertifikat untuk kegiatan ini sedang tidak dibuka.
          </div>
        ) : fields.length === 0 ? (
          <div className="mt-5 rounded-[var(--radius-md)] bg-[var(--color-canvas)] p-4 text-sm text-[var(--color-text-secondary)]">
            Formulir kegiatan belum dipublikasikan oleh panitia.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {submitError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger-bg)] p-3.5 text-sm text-[var(--color-danger)]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            )}

            {event.attendanceMode === 'pin' && (
              <div>
                <label htmlFor="att-pin" className="block text-sm font-medium">
                  PIN Kehadiran Kegiatan <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  id="att-pin"
                  type="password"
                  required
                  value={attendancePin}
                  onChange={(e) => setAttendancePin(e.target.value)}
                  placeholder="Masukkan PIN dari panitia"
                  className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
                />
              </div>
            )}

            {fields.map((field) => {
              const errMsg = fieldErrors[field.fieldKey];
              const val = values[field.fieldKey];
              const inputId = `field-${field.fieldKey}`;

              return (
                <div key={field.id}>
                  <label htmlFor={inputId} className="block text-sm font-medium">
                    {field.label}
                    {field.required && <span className="ml-1 text-[var(--color-danger)]">*</span>}
                  </label>
                  {field.description && (
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      {field.description}
                    </p>
                  )}

                  {field.inputType === 'textarea' ? (
                    <textarea
                      id={inputId}
                      rows={3}
                      value={typeof val === 'string' ? val : ''}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [field.fieldKey]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      aria-invalid={Boolean(errMsg)}
                      className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 text-base"
                    />
                  ) : field.inputType === 'select' ? (
                    <select
                      id={inputId}
                      value={typeof val === 'string' ? val : ''}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [field.fieldKey]: e.target.value }))
                      }
                      aria-invalid={Boolean(errMsg)}
                      className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base"
                    >
                      <option value="">Pilih {field.label}</option>
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.inputType === 'checkbox' ? (
                    <label className="mt-2 inline-flex items-center gap-2 text-sm">
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={val === true}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [field.fieldKey]: e.target.checked }))
                        }
                      />
                      <span>{field.placeholder || field.label}</span>
                    </label>
                  ) : (
                    <input
                      id={inputId}
                      type={field.inputType === 'nik' ? 'text' : field.inputType}
                      inputMode={field.inputType === 'nik' ? 'numeric' : undefined}
                      maxLength={field.inputType === 'nik' ? 16 : undefined}
                      value={typeof val === 'string' ? val : ''}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [field.fieldKey]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      aria-invalid={Boolean(errMsg)}
                      className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
                    />
                  )}

                  {errMsg && (
                    <p className="mt-1 text-xs font-medium text-[var(--color-danger)]">{errMsg}</p>
                  )}
                </div>
              );
            })}

            <div className="rounded-[var(--radius-md)] bg-[var(--color-canvas)] p-4 text-xs leading-relaxed text-[var(--color-text-secondary)]">
              <p className="font-semibold text-[var(--color-text-primary)]">
                Pemberitahuan Privasi (v{privacyNoticeVersion})
              </p>
              <p className="mt-1">
                Data yang Anda kirimkan diproses oleh Puskesmas Sumbermanjing Kulon khusus untuk
                penerbitan, pengiriman email lampiran PDF, pengunduhan mandiri, dan verifikasi
                keaslian sertifikat kegiatan.
              </p>
              <label className="mt-3 flex items-start gap-2 text-xs font-medium text-[var(--color-text-primary)]">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>Saya telah memeriksa kebenaran data dan menyetujui pemrosesan data ini.</span>
              </label>
            </div>

            {turnstileSiteKey && (
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                onToken={setTurnstileToken}
                resetCounter={turnstileResetCount}
              />
            )}

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="inline-flex min-h-[46px] w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-sm font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)] disabled:opacity-60"
            >
              {registerMutation.isPending ? 'Mengirim Data...' : 'Kirim Data Sertifikat'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
