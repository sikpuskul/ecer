import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { formatJakartaDate } from '@shared/utils/jakarta-date';
import { fetchPublicVerification } from '@/features/public-dashboard/api';

const DOC_TYPE_LABEL: Record<string, string> = {
  certificate: 'Sertifikat Kegiatan',
  award: 'Piagam Penghargaan',
};

export function PublicVerifyPage() {
  const { verificationCode } = useParams();

  // PRD §17.3: Verification pages must not be indexed by search engines
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const verifyQuery = useQuery({
    queryKey: ['public', 'verify', verificationCode],
    queryFn: () => fetchPublicVerification(verificationCode!),
    enabled: Boolean(verificationCode),
    retry: false,
  });

  if (verifyQuery.isPending) {
    return (
      <div className="mx-auto max-w-xl rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Memeriksa keabsahan dokumen...</p>
      </div>
    );
  }

  if (verifyQuery.isError || !verifyQuery.data) {
    return (
      <div className="mx-auto max-w-xl rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger-bg)] p-6 text-center">
        <XCircle className="mx-auto h-10 w-10 text-[var(--color-danger)]" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-bold text-[var(--color-danger)]">
          Gagal Memeriksa Dokumen
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Terjadi kendala saat menghubungi server verifikasi. Silakan muat ulang halaman.
        </p>
      </div>
    );
  }

  const data = verifyQuery.data;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        {/* Status Banner */}
        {data.state === 'VALID' && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-accent-mint)]/50 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-green)] text-[var(--color-surface)]">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-forest)] px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--color-surface)] uppercase">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Terverifikasi Sah
                </span>
                <h1 className="mt-1 text-lg font-bold text-[var(--color-primary-forest)]">
                  Dokumen Tercatat Resmi di ECER
                </h1>
              </div>
            </div>
          </div>
        )}

        {data.state === 'REVOKED' && (
          <div className="border-b border-[var(--color-danger)]/20 bg-[var(--color-danger-bg)] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-danger)] text-[var(--color-surface)]">
                <ShieldAlert className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <span className="inline-flex rounded-full bg-[var(--color-danger)] px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--color-surface)] uppercase">
                  Dicabut (Revoked)
                </span>
                <h1 className="mt-1 text-lg font-bold text-[var(--color-danger)]">
                  Dokumen Ini Telah Dicabut
                </h1>
              </div>
            </div>
          </div>
        )}

        {data.state === 'NOT_FOUND' && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-canvas)] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-text-secondary)]/15 text-[var(--color-text-secondary)]">
                <XCircle className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <span className="inline-flex rounded-full bg-[var(--color-text-secondary)]/20 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--color-text-primary)] uppercase">
                  Tidak Ditemukan
                </span>
                <h1 className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">
                  Kode Verifikasi Tidak Terdaftar
                </h1>
              </div>
            </div>
          </div>
        )}

        {data.state === 'UNAVAILABLE' && (
          <div className="border-b border-[var(--color-warning)]/20 bg-[var(--color-warning-bg)] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-warning)] text-[var(--color-surface)]">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <span className="inline-flex rounded-full bg-[var(--color-warning)] px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--color-surface)] uppercase">
                  Belum Tersedia
                </span>
                <h1 className="mt-1 text-lg font-bold text-[var(--color-warning)]">
                  Dokumen Masih Dalam Proses
                </h1>
              </div>
            </div>
          </div>
        )}

        {/* Metadata Body */}
        <div className="p-6">
          {(data.state === 'VALID' || data.state === 'REVOKED') && (
            <dl className="divide-y divide-[var(--color-border)] text-sm">
              <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3">
                <dt className="font-medium text-[var(--color-text-secondary)]">Nomor Dokumen</dt>
                <dd className="font-mono font-semibold text-[var(--color-text-primary)] sm:col-span-2">
                  {data.documentNumber}
                </dd>
              </div>
              <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3">
                <dt className="font-medium text-[var(--color-text-secondary)]">Nama Penerima</dt>
                <dd className="font-semibold text-[var(--color-text-primary)] sm:col-span-2">
                  {data.recipientName}
                </dd>
              </div>
              <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3">
                <dt className="font-medium text-[var(--color-text-secondary)]">Kegiatan</dt>
                <dd className="text-[var(--color-text-primary)] sm:col-span-2">
                  {data.eventTitle}
                </dd>
              </div>
              <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3">
                <dt className="font-medium text-[var(--color-text-secondary)]">Jenis Dokumen</dt>
                <dd className="text-[var(--color-text-primary)] sm:col-span-2">
                  {data.documentType
                    ? (DOC_TYPE_LABEL[data.documentType] ?? data.documentType)
                    : '-'}
                </dd>
              </div>
              <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3">
                <dt className="font-medium text-[var(--color-text-secondary)]">Penyelenggara</dt>
                <dd className="text-[var(--color-text-primary)] sm:col-span-2">{data.organizer}</dd>
              </div>
              {data.issuedAt && (
                <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3">
                  <dt className="font-medium text-[var(--color-text-secondary)]">Tanggal Terbit</dt>
                  <dd className="tabular-nums text-[var(--color-text-primary)] sm:col-span-2">
                    {formatJakartaDate(data.issuedAt, true)}
                  </dd>
                </div>
              )}
              <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3">
                <dt className="font-medium text-[var(--color-text-secondary)]">Revisi</dt>
                <dd className="tabular-nums text-[var(--color-text-primary)] sm:col-span-2">
                  Revisi ke-{data.revisionNumber ?? 1}
                </dd>
              </div>
              {data.state === 'REVOKED' && (
                <>
                  {data.revokedAt && (
                    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3">
                      <dt className="font-medium text-[var(--color-danger)]">Tanggal Pencabutan</dt>
                      <dd className="tabular-nums text-[var(--color-danger)] sm:col-span-2">
                        {formatJakartaDate(data.revokedAt, true)}
                      </dd>
                    </div>
                  )}
                  {data.revokedReason && (
                    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3">
                      <dt className="font-medium text-[var(--color-danger)]">Alasan Pencabutan</dt>
                      <dd className="text-[var(--color-danger)] sm:col-span-2">
                        {data.revokedReason}
                      </dd>
                    </div>
                  )}
                </>
              )}
            </dl>
          )}

          {data.state === 'NOT_FOUND' && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Kode verifikasi yang dipindai tidak cocok dengan catatan dokumen aktif mana pun di
              sistem ECER Puskesmas Sumbermanjing Kulon. Pastikan QR code dipindai dari dokumen
              resmi.
            </p>
          )}

          {data.state === 'UNAVAILABLE' && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Dokumen dengan kode ini sedang dalam proses penerbitan oleh sistem. Silakan pindai
              kembali beberapa saat lagi.
            </p>
          )}

          {/* PRD §17.4: Non-e-signature disclaimer */}
          <div className="mt-5 flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-canvas)] p-3.5 text-xs text-[var(--color-text-secondary)]">
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary-green)]"
              aria-hidden="true"
            />
            <p>
              Halaman ini memverifikasi catatan penerbitan dokumen pada sistem ECER Puskesmas
              Sumbermanjing Kulon dan bukan merupakan tanda tangan elektronik tersertifikasi (BSrE).
              Demi privasi, data identitas sensitif tidak ditampilkan.
            </p>
          </div>
        </div>
      </section>

      <div className="text-center">
        <Link
          to="/"
          className="text-sm font-semibold text-[var(--color-primary-green)] hover:underline"
        >
          Ke Beranda ECER
        </Link>
      </div>
    </div>
  );
}
