import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Ban, Download, Mail, RefreshCw } from 'lucide-react';
import { formatJakartaDate } from '@shared/utils/jakarta-date';
import { ApiClientError } from '@/lib/api-client';
import { resendDocumentEmailApi } from '@/features/email/api';
import { fetchAdminDocuments, regenerateDocumentApi, revokeDocumentApi } from '../api';

export function AdminCertificatesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const docsQuery = useQuery({
    queryKey: ['admin', 'documents', statusFilter],
    queryFn: () =>
      fetchAdminDocuments({
        page: 1,
        limit: 30,
        status: statusFilter || undefined,
      }),
  });

  const regenMutation = useMutation({
    mutationFn: regenerateDocumentApi,
    onSuccess: () => {
      setFeedback({
        type: 'success',
        text: 'Job regenerasi dokumen berhasil dibuat (nomor dan kode verifikasi tetap sama).',
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal meregenerate dokumen.',
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => revokeDocumentApi(id, reason),
    onSuccess: () => {
      setFeedback({
        type: 'success',
        text: 'Dokumen telah dicabut dan seluruh izin unduhan aktif telah dibatalkan.',
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal mencabut dokumen.',
      });
    },
  });

  const resendEmailMutation = useMutation({
    mutationFn: resendDocumentEmailApi,
    onSuccess: () => {
      setFeedback({
        type: 'success',
        text: 'Email sertifikat telah dijadwalkan untuk dikirim ulang.',
      });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal mengirim ulang email.',
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-primary-forest)]">
            Sertifikat &amp; Dokumen Terbit
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Pantau status penerbitan, lakukan regenerasi revisi baru, atau cabut keabsahan dokumen.
          </p>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter status dokumen"
          className="min-h-[42px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
        >
          <option value="">Semua Status</option>
          <option value="ready">Ready</option>
          <option value="queued">Queued</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
          <option value="revoked">Revoked</option>
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
        {docsQuery.isPending ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Memuat daftar dokumen...</p>
        ) : (docsQuery.data?.items ?? []).length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Belum ada dokumen sertifikat atau piagam yang diterbitkan.
          </p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {(docsQuery.data?.items ?? []).map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{doc.recipientName}</p>
                    <span className="rounded-full bg-[var(--color-canvas)] px-2.5 py-0.5 font-mono text-xs">
                      {doc.documentNumber}
                    </span>
                    <span className="rounded-full bg-[var(--color-accent-mint)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary-forest)]">
                      {doc.documentStatus} · rev {doc.revisionCount}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {doc.eventTitle} · Terbit: {formatJakartaDate(doc.issuedAt, true)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {doc.documentStatus === 'ready' && (
                    <>
                      <a
                        href={`/api/v1/admin/documents/${encodeURIComponent(doc.id)}/download`}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-3 text-xs font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)]"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Unduh PDF</span>
                      </a>
                      <button
                        type="button"
                        disabled={resendEmailMutation.isPending}
                        onClick={() => resendEmailMutation.mutate(doc.id)}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-xs font-semibold hover:bg-[var(--color-canvas)]"
                      >
                        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Kirim Email</span>
                      </button>
                    </>
                  )}
                  {doc.documentStatus !== 'revoked' && (
                    <>
                      <button
                        type="button"
                        disabled={regenMutation.isPending}
                        onClick={() => regenMutation.mutate(doc.id)}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-xs font-semibold hover:bg-[var(--color-canvas)]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Regenerate</span>
                      </button>

                      <button
                        type="button"
                        disabled={revokeMutation.isPending}
                        onClick={() => {
                          const reason = window.prompt(
                            `Masukkan alasan pencabutan dokumen ${doc.documentNumber} (min. 5 karakter):`,
                          );
                          if (reason && reason.trim().length >= 5) {
                            revokeMutation.mutate({ id: doc.id, reason: reason.trim() });
                          }
                        }}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                      >
                        <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Cabut</span>
                      </button>
                    </>
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
