import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Download, ShieldAlert, Trash2 } from 'lucide-react';
import { formatJakartaDate, getCurrentJakartaMonthYear } from '@shared/utils/jakarta-date';
import { ApiClientError } from '@/lib/api-client';
import { fetchReportOverview, fetchRetentionDryRun, runRetentionCleanupApi } from '../api';

export function AdminReportsPage() {
  const queryClient = useQueryClient();
  const currentYear = getCurrentJakartaMonthYear().year;
  const [year, setYear] = useState(currentYear);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const reportQuery = useQuery({
    queryKey: ['admin', 'reports', 'overview', year],
    queryFn: () => fetchReportOverview(year),
  });

  const retentionQuery = useQuery({
    queryKey: ['admin', 'reports', 'retention-dry-run'],
    queryFn: fetchRetentionDryRun,
  });

  const cleanupMutation = useMutation({
    mutationFn: runRetentionCleanupApi,
    onSuccess: (res) => {
      setFeedback({
        type: 'success',
        text: `Pembersihan selesai: ${res.deletedSessions} sesi, ${res.deletedDownloadGrants} grant unduh, ${res.deletedChallenges} OTP, dan ${res.deletedReplays} replay nonce kedaluwarsa dihapus.`,
      });
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'reports', 'retention-dry-run'],
      });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text:
          err instanceof ApiClientError ? err.message : 'Gagal menjalankan pembersihan retensi.',
      });
    },
  });

  const report = reportQuery.data;
  const maxMonthlyDocs = Math.max(
    1,
    ...(report?.monthlySeries.map((m) => m.certificatesIssued + m.awardsIssued) ?? [1]),
  );

  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-primary-forest)]">
            Laporan &amp; Operasional Retensi
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Ringkasan kinerja penerbitan tahunan, ekspor CSV aman, serta pemantauan dry-run retensi
            data operasional.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="Pilih tahun laporan"
            className="min-h-[42px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                Tahun {y}
              </option>
            ))}
          </select>

          <a
            href={`/api/v1/admin/reports/export.csv?year=${year}`}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-xs font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)]"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Export CSV Aman ({year})</span>
          </a>
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2.5 rounded-[var(--radius-md)] border p-3.5 text-sm ${
            feedback.type === 'error'
              ? 'border-[var(--color-danger)]/20 bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
              : 'border-[var(--color-success)]/20 bg-[var(--color-success-bg)] text-[var(--color-success)]'
          }`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 4 KPI Cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">Total Kegiatan</p>
          <p className="tabular-nums mt-1.5 text-2xl font-bold text-[var(--color-primary-forest)]">
            {report?.totals.events ?? 0}
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">Total Peserta</p>
          <p className="tabular-nums mt-1.5 text-2xl font-bold text-[var(--color-text-primary)]">
            {report?.totals.participants ?? 0}
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
            Sertifikat Terbit
          </p>
          <p className="tabular-nums mt-1.5 text-2xl font-bold text-[var(--color-primary-green)]">
            {report?.totals.certificatesIssued ?? 0}
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">Piagam Terbit</p>
          <p className="tabular-nums mt-1.5 text-2xl font-bold text-[var(--color-primary-forest)]">
            {report?.totals.awardsIssued ?? 0}
          </p>
        </div>
      </section>

      {/* Lightweight Pure-CSS Monthly Trend Bar Chart */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[var(--color-primary-forest)]">
            Tren Penerbitan Bulanan ({year})
          </h2>
          <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[var(--color-primary-green)]" />
              Sertifikat
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[var(--color-primary-forest)]" />
              Piagam
            </span>
          </div>
        </div>

        <div
          className="mt-5 grid grid-cols-12 items-end gap-2 pt-2"
          style={{ minHeight: '180px' }}
          aria-label={`Grafik penerbitan bulanan tahun ${year}`}
        >
          {(report?.monthlySeries ?? []).map((pt) => {
            const certPct = Math.round((pt.certificatesIssued / maxMonthlyDocs) * 100);
            const awardPct = Math.round((pt.awardsIssued / maxMonthlyDocs) * 100);
            const total = pt.certificatesIssued + pt.awardsIssued;
            return (
              <div key={pt.month} className="flex flex-col items-center gap-1.5">
                <span className="tabular-nums text-[10px] font-medium text-[var(--color-text-secondary)]">
                  {total > 0 ? total : ''}
                </span>
                <div className="flex h-32 w-full max-w-[28px] flex-col justify-end overflow-hidden rounded-t-[var(--radius-sm)] bg-[var(--color-canvas)]">
                  {awardPct > 0 && (
                    <div
                      title={`${pt.label}: ${pt.awardsIssued} piagam`}
                      style={{ height: `${Math.max(4, awardPct)}%` }}
                      className="w-full bg-[var(--color-primary-forest)]"
                    />
                  )}
                  {certPct > 0 && (
                    <div
                      title={`${pt.label}: ${pt.certificatesIssued} sertifikat`}
                      style={{ height: `${Math.max(4, certPct)}%` }}
                      className="w-full bg-[var(--color-primary-green)]"
                    />
                  )}
                </div>
                <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                  {pt.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Category Breakdown & Top Events */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-base font-bold text-[var(--color-primary-forest)]">
            Ringkasan per Kategori
          </h2>
          {(report?.categoryBreakdown ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              Belum ada data kegiatan pada tahun {year}.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-[var(--color-border)] text-sm">
              {(report?.categoryBreakdown ?? []).map((cat) => (
                <div key={cat.categoryName} className="flex items-center justify-between py-2.5">
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {cat.categoryName}
                  </span>
                  <span className="tabular-nums text-xs text-[var(--color-text-secondary)]">
                    {cat.eventCount} keg · {cat.certificateCount} sert · {cat.awardCount} piagam
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-base font-bold text-[var(--color-primary-forest)]">
            Daftar Kegiatan ({year})
          </h2>
          {(report?.topEvents ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              Belum ada kegiatan pada tahun {year}.
            </p>
          ) : (
            <div className="mt-3 max-h-72 divide-y divide-[var(--color-border)] overflow-y-auto text-sm">
              {(report?.topEvents ?? []).slice(0, 15).map((ev) => (
                <div key={ev.eventId} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-[var(--color-text-primary)]">
                      {ev.title}
                    </p>
                    <span className="shrink-0 rounded-full bg-[var(--color-canvas)] px-2 py-0.5 font-mono text-[11px]">
                      {ev.eventCode}
                    </span>
                  </div>
                  <p className="mt-0.5 tabular-nums text-xs text-[var(--color-text-secondary)]">
                    {formatJakartaDate(ev.eventStartAt)} · {ev.participantCount} peserta ·{' '}
                    {ev.certificateCount} sertifikat · {ev.awardCount} piagam
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Retention Dry-Run & Safe Ephemeral Cleanup */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--color-primary-forest)]">
              Retensi Data &amp; Dry-Run Cleanup
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Pratinjau catatan keamanan kedaluwarsa yang aman dibersihkan. Pembersihan ini{' '}
              <strong>tidak pernah</strong> menghapus dokumen sertifikat, piagam, atau file PDF di
              Google Drive.
            </p>
          </div>

          <button
            type="button"
            disabled={cleanupMutation.isPending}
            onClick={() => {
              if (
                window.confirm(
                  'Hapus seluruh sesi admin, download grant, kode OTP, dan replay nonce yang sudah kedaluwarsa?',
                )
              ) {
                cleanupMutation.mutate();
              }
            }}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-canvas)] disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {cleanupMutation.isPending ? 'Membersihkan...' : 'Bersihkan Token Kedaluwarsa'}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-[var(--radius-md)] bg-[var(--color-canvas)] p-3">
            <p className="text-[11px] text-[var(--color-text-secondary)]">Sesi Admin Kedaluwarsa</p>
            <p className="tabular-nums mt-1 text-lg font-bold">
              {retentionQuery.data?.expiredSessions ?? 0}
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--color-canvas)] p-3">
            <p className="text-[11px] text-[var(--color-text-secondary)]">Download Grant Habis</p>
            <p className="tabular-nums mt-1 text-lg font-bold">
              {retentionQuery.data?.expiredDownloadGrants ?? 0}
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--color-canvas)] p-3">
            <p className="text-[11px] text-[var(--color-text-secondary)]">OTP Kedaluwarsa</p>
            <p className="tabular-nums mt-1 text-lg font-bold">
              {retentionQuery.data?.expiredChallenges ?? 0}
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--color-canvas)] p-3">
            <p className="text-[11px] text-[var(--color-text-secondary)]">Replay Nonce Habis</p>
            <p className="tabular-nums mt-1 text-lg font-bold">
              {retentionQuery.data?.expiredReplays ?? 0}
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--color-warning-bg)] p-3">
            <p className="flex items-center gap-1 text-[11px] text-[var(--color-warning)]">
              <ShieldAlert className="h-3 w-3" aria-hidden="true" />
              Revisi Superseded (&gt;90h)
            </p>
            <p className="tabular-nums mt-1 text-lg font-bold text-[var(--color-warning)]">
              {retentionQuery.data?.oldSupersededRevisions ?? 0}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
