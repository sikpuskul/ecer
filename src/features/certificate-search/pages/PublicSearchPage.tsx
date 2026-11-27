import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  KeyRound,
  Mail,
} from 'lucide-react';
import { Link, useParams } from 'react-router';
import { formatJakartaDate } from '@shared/utils/jakarta-date';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { ApiClientError, fetchPublicConfig } from '@/lib/api-client';
import {
  fetchPublicEventDetail,
  resendOtpApi,
  verifyRecoveryApi,
} from '@/features/public-dashboard/api';

const SEARCH_KEY_LABELS: Record<
  string,
  { label: string; placeholder: string; inputMode: 'text' | 'email' | 'numeric' }
> = {
  nik: {
    label: 'NIK (16 Digit)',
    placeholder: 'Masukkan 16 digit NIK sesuai pendaftaran',
    inputMode: 'numeric',
  },
  email: {
    label: 'Alamat Email',
    placeholder: 'nama@email.com',
    inputMode: 'email',
  },
  nama: {
    label: 'Nama Lengkap',
    placeholder: 'Masukkan nama lengkap sesuai pendaftaran',
    inputMode: 'text',
  },
  nip: {
    label: 'NIP / Nomor Identitas',
    placeholder: 'Masukkan NIP sesuai pendaftaran',
    inputMode: 'text',
  },
};

export function PublicSearchPage() {
  const { slug } = useParams();
  const [searchKey, setSearchKey] = useState('');
  const [method, setMethod] = useState<'recovery_code' | 'email_otp'>('recovery_code');
  const [code, setCode] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>(undefined);
  const [turnstileResetCount, setTurnstileResetCount] = useState(0);
  const [otpFeedback, setOtpFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const configQuery = useQuery({
    queryKey: ['public', 'config'],
    queryFn: fetchPublicConfig,
    staleTime: 5 * 60_000,
  });

  const eventQuery = useQuery({
    queryKey: ['public', 'event-detail', slug],
    queryFn: () => fetchPublicEventDetail(slug!),
    enabled: Boolean(slug),
  });

  const turnstileSiteKey = configQuery.data?.turnstileSiteKey ?? null;

  const resetTurnstile = () => {
    setTurnstileResetCount((c) => c + 1);
  };

  const otpMutation = useMutation({
    mutationFn: () =>
      resendOtpApi({
        slug: slug!,
        searchKey: searchKey.trim(),
        turnstileToken,
      }),
    onSuccess: (res) => {
      setErrorMsg(null);
      setOtpFeedback(res.message);
      resetTurnstile();
    },
    onError: (err) => {
      setErrorMsg(
        err instanceof ApiClientError ? err.message : 'Gagal mengirim kode OTP. Silakan coba lagi.',
      );
      resetTurnstile();
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () =>
      verifyRecoveryApi({
        slug: slug!,
        searchKey: searchKey.trim(),
        method,
        code: code.trim(),
        turnstileToken,
      }),
    onSuccess: () => {
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(
        err instanceof ApiClientError
          ? err.message
          : 'Data tidak cocok atau kode verifikasi tidak valid.',
      );
      resetTurnstile();
    },
  });

  if (eventQuery.isPending) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">Memuat informasi kegiatan...</p>
    );
  }

  if (eventQuery.isError || !eventQuery.data) {
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

  const event = eventQuery.data;
  const keyMeta = SEARCH_KEY_LABELS[event.searchKeyField] ?? {
    label: `Kunci Pencarian (${event.searchKeyField.toUpperCase()})`,
    placeholder: 'Masukkan data sesuai pendaftaran',
    inputMode: 'text' as const,
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!searchKey.trim()) {
      setErrorMsg(`${keyMeta.label} wajib diisi.`);
      return;
    }
    if (!code.trim()) {
      setErrorMsg(
        method === 'recovery_code'
          ? 'Kode pemulihan wajib diisi.'
          : 'Kode OTP 6 digit wajib diisi.',
      );
      return;
    }
    verifyMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          to="/"
          className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-semibold text-[var(--color-primary-green)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Daftar Kegiatan</span>
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-primary-forest)]">
          Cari &amp; Unduh Sertifikat
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{event.title}</p>
      </div>

      {!event.eligibility.canDownload && (
        <div
          role="status"
          className="rounded-[var(--radius-lg)] border border-[var(--color-warning)]/25 bg-[var(--color-warning-bg)] p-4 text-sm text-[var(--color-warning)]"
        >
          Periode pengunduhan sertifikat untuk kegiatan ini sedang tidak dibuka. Anda tetap dapat
          memeriksa status verifikasi, namun tombol unduh hanya aktif saat periode unduh dibuka.
        </div>
      )}

      {verifyMutation.isSuccess && verifyMutation.data ? (
        <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-success)]"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-base font-bold text-[var(--color-primary-forest)]">
                Verifikasi Berhasil
              </h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                Izin akses dokumen aktif selama{' '}
                {Math.round(verifyMutation.data.grantExpiresInSeconds / 60)} menit pada browser ini.
              </p>
            </div>
          </div>

          {verifyMutation.data.documents.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-canvas)] p-4 text-sm text-[var(--color-text-secondary)]">
              Data kepesertaan ditemukan, namun dokumen sertifikat Anda masih dalam proses
              penerbitan atau menunggu persetujuan panitia. Silakan periksa kembali beberapa saat
              lagi.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {verifyMutation.data.documents.map((doc) => (
                <div
                  key={doc.publicId}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText
                        className="h-4 w-4 text-[var(--color-primary-green)]"
                        aria-hidden="true"
                      />
                      <span className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
                        {doc.documentNumber}
                      </span>
                      <span className="rounded-full bg-[var(--color-accent-mint)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary-forest)]">
                        {doc.documentStatus === 'ready' ? 'Siap Diunduh' : doc.documentStatus}
                      </span>
                    </div>
                    {doc.issuedAt && (
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Diterbitkan: {formatJakartaDate(doc.issuedAt, true)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {doc.documentStatus === 'ready' && doc.canDownload ? (
                      <>
                        <a
                          href={`/api/v1/public/documents/${encodeURIComponent(doc.publicId)}/preview`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-canvas)]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Preview PDF</span>
                        </a>
                        <a
                          href={`/api/v1/public/documents/${encodeURIComponent(doc.publicId)}/download`}
                          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-xs font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)]"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Unduh Sertifikat</span>
                        </a>
                      </>
                    ) : (
                      <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                        {doc.documentStatus !== 'ready'
                          ? 'Dokumen sedang diproses'
                          : 'Periode unduh belum dibuka'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              verifyMutation.reset();
              setCode('');
            }}
            className="text-xs font-semibold text-[var(--color-primary-green)] hover:underline"
          >
            Cari dengan data lain
          </button>
        </section>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
        >
          <div>
            <label
              htmlFor="searchKey"
              className="block text-sm font-semibold text-[var(--color-text-primary)]"
            >
              {keyMeta.label} <span className="text-[var(--color-danger)]">*</span>
            </label>
            <input
              id="searchKey"
              type={keyMeta.inputMode === 'email' ? 'email' : 'text'}
              inputMode={keyMeta.inputMode}
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              placeholder={keyMeta.placeholder}
              required
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3.5 text-base sm:text-sm"
            />
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-[var(--color-text-primary)]">
              Metode Verifikasi
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setMethod('recovery_code');
                  setCode('');
                  setErrorMsg(null);
                }}
                className={`flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-md)] border px-3 text-sm font-semibold transition-colors ${
                  method === 'recovery_code'
                    ? 'border-[var(--color-primary-green)] bg-[var(--color-accent-mint)]/50 text-[var(--color-primary-forest)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)]'
                }`}
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                <span>Kode Pemulihan</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMethod('email_otp');
                  setCode('');
                  setErrorMsg(null);
                }}
                className={`flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-md)] border px-3 text-sm font-semibold transition-colors ${
                  method === 'email_otp'
                    ? 'border-[var(--color-primary-green)] bg-[var(--color-accent-mint)]/50 text-[var(--color-primary-forest)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)]'
                }`}
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                <span>Kode OTP Email</span>
              </button>
            </div>
          </fieldset>

          {method === 'email_otp' && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-canvas)] p-3.5">
              <p className="text-xs text-[var(--color-text-secondary)]">
                Lupa kode pemulihan? Kami dapat mengirim kode OTP 6 digit (berlaku 5 menit) ke email
                yang Anda daftarkan.
              </p>
              <button
                type="button"
                disabled={otpMutation.isPending || !searchKey.trim()}
                onClick={() => otpMutation.mutate()}
                className="mt-2.5 inline-flex min-h-[38px] items-center rounded-[var(--radius-md)] border border-[var(--color-primary-green)] bg-[var(--color-surface)] px-3.5 text-xs font-semibold text-[var(--color-primary-forest)] hover:bg-[var(--color-accent-mint)]/40 disabled:opacity-50"
              >
                {otpMutation.isPending ? 'Memproses...' : 'Kirim Kode OTP ke Email'}
              </button>
              {otpFeedback && (
                <p role="status" className="mt-2 text-xs font-medium text-[var(--color-success)]">
                  {otpFeedback}
                </p>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="recoveryCode"
              className="block text-sm font-semibold text-[var(--color-text-primary)]"
            >
              {method === 'recovery_code' ? 'Kode Pemulihan' : 'Kode OTP Email (6 Digit)'}{' '}
              <span className="text-[var(--color-danger)]">*</span>
            </label>
            <input
              id="recoveryCode"
              type="text"
              inputMode={method === 'email_otp' ? 'numeric' : 'text'}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={
                method === 'recovery_code'
                  ? 'Masukkan kode pemulihan dari bukti pendaftaran'
                  : 'Masukkan 6 digit kode OTP'
              }
              required
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3.5 font-mono text-base sm:text-sm"
            />
          </div>

          {turnstileSiteKey && (
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              onToken={setTurnstileToken}
              resetCounter={turnstileResetCount}
            />
          )}

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger-bg)] p-3.5 text-sm text-[var(--color-danger)]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={verifyMutation.isPending}
            className="inline-flex min-h-[46px] w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-5 text-sm font-semibold text-[var(--color-surface)] transition-colors hover:bg-[var(--color-primary-forest)] disabled:opacity-60"
          >
            {verifyMutation.isPending ? 'Memverifikasi...' : 'Verifikasi & Cari Sertifikat'}
          </button>
        </form>
      )}
    </div>
  );
}
