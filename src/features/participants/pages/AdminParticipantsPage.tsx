import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Check, Plus, X } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { formatJakartaDate } from '@shared/utils/jakarta-date';
import { ApiClientError } from '@/lib/api-client';
import {
  addAdminWhitelist,
  fetchAdminParticipants,
  fetchAdminWhitelist,
  updateAdminParticipantAction,
} from '@/features/public-dashboard/api';

export function AdminParticipantsPage() {
  const { id: eventId } = useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'participants' | 'whitelist'>('participants');
  const [statusFilter, setStatusFilter] = useState('');
  const [whitelistRaw, setWhitelistRaw] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const participantsQuery = useQuery({
    queryKey: ['admin', 'participants', eventId, statusFilter],
    queryFn: () =>
      fetchAdminParticipants({
        eventId: eventId!,
        status: statusFilter || undefined,
        page: 1,
        limit: 50,
      }),
    enabled: Boolean(eventId) && tab === 'participants',
  });

  const whitelistQuery = useQuery({
    queryKey: ['admin', 'whitelist', eventId],
    queryFn: () => fetchAdminWhitelist(eventId!),
    enabled: Boolean(eventId) && tab === 'whitelist',
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' | 'cancel' }) =>
      updateAdminParticipantAction(id, action),
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Status peserta berhasil diperbarui.' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'participants', eventId] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal memperbarui status peserta.',
      });
    },
  });

  const whitelistMutation = useMutation({
    mutationFn: (entries: Array<{ key: string; label: string }>) =>
      addAdminWhitelist(eventId!, { entries }),
    onSuccess: (res) => {
      setWhitelistRaw('');
      setFeedback({
        type: 'success',
        text: `${res.addedCount} entri whitelist berhasil diproses.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'whitelist', eventId] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal menambahkan whitelist.',
      });
    },
  });

  function handleWhitelistSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const lines = whitelistRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const entries = lines.map((line) => {
      const [key, label] = line.split(',').map((s) => s.trim());
      return { key: key ?? line, label: label || '' };
    });
    whitelistMutation.mutate(entries);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to={`/admin/kegiatan/${eventId}/edit`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary-forest)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Kembali ke Editor Kegiatan</span>
          </Link>
          <h1 className="mt-1 text-xl font-bold text-[var(--color-primary-forest)]">
            Peserta &amp; Whitelist Kegiatan
          </h1>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('participants')}
            className={`min-h-[40px] rounded-[var(--radius-md)] px-4 text-xs font-semibold ${
              tab === 'participants'
                ? 'bg-[var(--color-primary-forest)] text-[var(--color-surface)]'
                : 'border border-[var(--color-border)] bg-[var(--color-surface)]'
            }`}
          >
            Daftar Peserta
          </button>
          <button
            type="button"
            onClick={() => setTab('whitelist')}
            className={`min-h-[40px] rounded-[var(--radius-md)] px-4 text-xs font-semibold ${
              tab === 'whitelist'
                ? 'bg-[var(--color-primary-forest)] text-[var(--color-surface)]'
                : 'border border-[var(--color-border)] bg-[var(--color-surface)]'
            }`}
          >
            Whitelist Kehadiran
          </button>
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

      {tab === 'participants' ? (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
            <h2 className="text-base font-semibold">
              Pengajuan Peserta ({participantsQuery.data?.meta.total ?? 0})
            </h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter status peserta"
              className="min-h-[40px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs"
            >
              <option value="">Semua Status</option>
              <option value="pending_review">Menunggu Persetujuan</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>

          {participantsQuery.isPending ? (
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">Memuat peserta...</p>
          ) : (participantsQuery.data?.items ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              Belum ada peserta terdaftar pada kegiatan ini.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-[var(--color-border)]">
              {(participantsQuery.data?.items ?? []).map((p) => {
                const nameVal = String(p.data.nama_lengkap ?? p.data.nama ?? 'Peserta');
                return (
                  <div
                    key={p.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{nameVal}</p>
                        <span className="rounded-full bg-[var(--color-canvas)] px-2.5 py-0.5 text-xs font-medium">
                          {p.submissionStatus}
                        </span>
                      </div>
                      <p className="tabular-nums mt-0.5 text-xs text-[var(--color-text-secondary)]">
                        Dikirim: {formatJakartaDate(p.submittedAt, true)}
                        {p.email ? ` · ${p.email}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {p.submissionStatus !== 'approved' ? (
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate({ id: p.id, action: 'approve' })}
                          className="inline-flex min-h-[38px] items-center gap-1 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-3 text-xs font-semibold text-[var(--color-surface)]"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Setujui</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate({ id: p.id, action: 'approve' })}
                          className="inline-flex min-h-[38px] items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-primary-green)] px-3 text-xs font-semibold text-[var(--color-primary-forest)] hover:bg-[var(--color-accent-mint)]/40"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Terbitkan Sertifikat</span>
                        </button>
                      )}
                      {p.submissionStatus !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate({ id: p.id, action: 'reject' })}
                          className="inline-flex min-h-[38px] items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Tolak</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <form onSubmit={handleWhitelistSubmit} className="space-y-3">
            <label htmlFor="wl-bulk" className="block text-sm font-semibold">
              Tambah Whitelist (1 baris per peserta: `key, Nama Opsional`)
            </label>
            <textarea
              id="wl-bulk"
              rows={4}
              value={whitelistRaw}
              onChange={(e) => setWhitelistRaw(e.target.value)}
              placeholder={'PST-001, Siti Aminah\nPST-002, Budi Santoso'}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 font-mono text-sm"
            />
            <button
              type="submit"
              disabled={whitelistMutation.isPending}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-xs font-semibold text-[var(--color-surface)]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Simpan Whitelist</span>
            </button>
          </form>

          <div className="border-t border-[var(--color-border)] pt-4">
            <h3 className="text-sm font-semibold">
              Daftar Whitelist ({whitelistQuery.data?.length ?? 0})
            </h3>
            <ul className="mt-2 divide-y divide-[var(--color-border)] text-sm">
              {(whitelistQuery.data ?? []).map((w) => (
                <li key={w.id} className="flex items-center justify-between py-2.5">
                  <span>{w.label}</span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {w.usedByParticipantId ? 'Sudah digunakan' : 'Tersedia'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
