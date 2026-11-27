import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Ban, RotateCcw } from 'lucide-react';
import { formatJakartaDate } from '@shared/utils/jakarta-date';
import { ApiClientError } from '@/lib/api-client';
import {
  cancelGenerationJobApi,
  fetchGenerationJobs,
  retryGenerationJobApi,
} from '@/features/certificates/api';

export function AdminJobsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const jobsQuery = useQuery({
    queryKey: ['admin', 'jobs', 'generation', statusFilter],
    queryFn: () =>
      fetchGenerationJobs({
        page: 1,
        limit: 30,
        status: statusFilter || undefined,
      }),
  });

  const retryMutation = useMutation({
    mutationFn: retryGenerationJobApi,
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Job dijadwalkan ulang untuk diproses.' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal menjalankan ulang job.',
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelGenerationJobApi,
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Job berhasil dibatalkan.' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal membatalkan job.',
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-primary-forest)]">
            Monitoring Generation Jobs
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Antrean durable pembuatan PDF di D1 beserta pemulihan otomatis Cron Trigger.
          </p>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter status job"
          className="min-h-[42px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
        >
          <option value="">Semua Status</option>
          <option value="queued">Queued</option>
          <option value="processing">Processing</option>
          <option value="retry_wait">Retry Wait</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
          <option value="needs_review">Needs Review</option>
        </select>
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

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        {jobsQuery.isPending ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Memuat daftar job...</p>
        ) : (jobsQuery.data?.items ?? []).length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Belum ada generation job.</p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {(jobsQuery.data?.items ?? []).map((job) => (
              <div
                key={job.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold">{job.documentNumber}</span>
                    <span className="rounded-full bg-[var(--color-canvas)] px-2.5 py-0.5 text-xs font-medium">
                      {job.jobStatus} · rev {job.revisionNumber}
                    </span>
                    <span className="tabular-nums text-xs text-[var(--color-text-secondary)]">
                      Percobaan {job.attempts}/{job.maxAttempts}
                    </span>
                  </div>
                  {job.safeErrorMessage && (
                    <p className="mt-1 text-xs text-[var(--color-danger)]">
                      {job.errorCode}: {job.safeErrorMessage}
                    </p>
                  )}
                  <p className="tabular-nums mt-0.5 text-xs text-[var(--color-text-secondary)]">
                    Diperbarui: {formatJakartaDate(job.updatedAt, true)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {['failed', 'retry_wait', 'needs_review'].includes(job.jobStatus) && (
                    <button
                      type="button"
                      onClick={() => retryMutation.mutate(job.id)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-3 text-xs font-semibold text-[var(--color-surface)]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Retry</span>
                    </button>
                  )}
                  {['queued', 'retry_wait', 'failed', 'needs_review'].includes(job.jobStatus) && (
                    <button
                      type="button"
                      onClick={() => cancelMutation.mutate(job.id)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-danger)]"
                    >
                      <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Batalkan</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
