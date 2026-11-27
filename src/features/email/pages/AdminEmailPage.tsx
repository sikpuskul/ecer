import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Mail, RefreshCw, XCircle } from 'lucide-react';
import { formatJakartaDate } from '@shared/utils/jakarta-date';
import { ApiClientError } from '@/lib/api-client';
import { cancelEmailJobApi, fetchEmailJobs, fetchEmailJobsSummary, retryEmailJobApi } from '../api';

const STATUS_BADGE: Record<string, string> = {
  sent: 'bg-[var(--color-accent-mint)] text-[var(--color-primary-forest)]',
  queued: 'bg-[var(--color-canvas)] text-[var(--color-text-secondary)]',
  processing: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  deferred_quota: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  retry_wait: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  failed: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
  needs_review: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
  cancelled: 'bg-[var(--color-canvas)] text-[var(--color-text-secondary)]',
};

export function AdminEmailPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const summaryQuery = useQuery({
    queryKey: ['admin', 'email-summary'],
    queryFn: fetchEmailJobsSummary,
  });

  const jobsQuery = useQuery({
    queryKey: ['admin', 'email-jobs', statusFilter],
    queryFn: () =>
      fetchEmailJobs({
        page: 1,
        limit: 30,
        status: statusFilter || undefined,
      }),
  });

  const retryMutation = useMutation({
    mutationFn: retryEmailJobApi,
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Email job dimasukkan kembali ke antrean kirim.' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'email-jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'email-summary'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal mengulang pengiriman email.',
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelEmailJobApi,
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Email job telah dibatalkan.' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'email-jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'email-summary'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal membatalkan email job.',
      });
    },
  });

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-primary-forest)]">
            Monitor Pengiriman Email
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Pantau sisa kuota harian Google Apps Script MailApp, status antrean pengiriman
            sertifikat, dan lakukan retry jika terjadi penundaan kuota.
          </p>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter status email job"
          className="min-h-[42px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
        >
          <option value="">Semua Status</option>
          <option value="queued">Queued</option>
          <option value="processing">Processing</option>
          <option value="sent">Sent</option>
          <option value="deferred_quota">Deferred Quota</option>
          <option value="retry_wait">Retry Wait</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Quota & Status Summary Cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="col-span-2 rounded-[var(--radius-lg)] border border-[var(--color-primary-green)]/30 bg-[var(--color-accent-mint)]/35 p-4 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary-forest)]">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Kuota MailApp</span>
          </div>
          <p className="tabular-nums mt-1.5 text-2xl font-bold text-[var(--color-primary-forest)]">
            {summary?.remainingDailyQuota !== null && summary?.remainingDailyQuota !== undefined
              ? summary.remainingDailyQuota
              : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
            Sisa kuota hari ini
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">Terkirim</p>
          <p className="tabular-nums mt-1.5 text-2xl font-bold text-[var(--color-primary-green)]">
            {summary?.sent ?? 0}
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">Antrean</p>
          <p className="tabular-nums mt-1.5 text-2xl font-bold text-[var(--color-text-primary)]">
            {(summary?.queued ?? 0) + (summary?.processing ?? 0) + (summary?.retryWait ?? 0)}
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">Tunda Kuota</p>
          <p className="tabular-nums mt-1.5 text-2xl font-bold text-[var(--color-warning)]">
            {summary?.deferredQuota ?? 0}
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">Gagal</p>
          <p className="tabular-nums mt-1.5 text-2xl font-bold text-[var(--color-danger)]">
            {(summary?.failed ?? 0) + (summary?.needsReview ?? 0)}
          </p>
        </div>
      </section>

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

      {/* Email Jobs Table */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        {jobsQuery.isPending ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Memuat antrean email...</p>
        ) : (jobsQuery.data?.items ?? []).length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Belum ada riwayat pengiriman email untuk filter ini.
          </p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {(jobsQuery.data?.items ?? []).map((job) => {
              const badgeStyle =
                STATUS_BADGE[job.jobStatus] ??
                'bg-[var(--color-canvas)] text-[var(--color-text-secondary)]';
              const canRetry = ['failed', 'retry_wait', 'deferred_quota', 'needs_review'].includes(
                job.jobStatus,
              );
              const canCancel = [
                'queued',
                'retry_wait',
                'deferred_quota',
                'failed',
                'needs_review',
              ].includes(job.jobStatus);

              return (
                <div
                  key={job.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[var(--color-text-primary)]">
                        {job.documentNumber}
                      </span>
                      <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                        {job.maskedEmail}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeStyle}`}
                      >
                        {job.jobStatus}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--color-text-primary)]">
                      {job.subject}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      {job.eventTitle} · Percobaan: {job.attempts}
                      {job.sentAt ? ` · Terkirim: ${formatJakartaDate(job.sentAt, true)}` : ''}
                      {job.nextAttemptAt && job.jobStatus !== 'sent'
                        ? ` · Jadwal berikutnya: ${formatJakartaDate(job.nextAttemptAt, true)}`
                        : ''}
                    </p>
                    {job.safeErrorMessage && (
                      <p className="mt-1 text-xs text-[var(--color-danger)]">
                        {job.safeErrorMessage}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canRetry && (
                      <button
                        type="button"
                        disabled={retryMutation.isPending}
                        onClick={() => retryMutation.mutate(job.id)}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-xs font-semibold hover:bg-[var(--color-canvas)]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Kirim Ulang</span>
                      </button>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        disabled={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(job.id)}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Batalkan</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
