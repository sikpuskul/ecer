import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  Copy,
  Edit3,
  Image as ImageIcon,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { ApiClientError, fetchAdminCategories } from '@/lib/api-client';
import { deleteAdminEvent, duplicateAdminEvent, fetchAdminEvents } from '../api';

const LIFECYCLE_LABELS: Record<string, { label: string; style: string }> = {
  draft: {
    label: 'Draft',
    style: 'bg-[var(--color-canvas)] text-[var(--color-text-secondary)]',
  },
  published: {
    label: 'Dipublikasikan',
    style: 'bg-[var(--color-accent-mint)] text-[var(--color-primary-forest)]',
  },
  closed: {
    label: 'Ditutup',
    style: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  },
  archived: {
    label: 'Diarsipkan',
    style: 'bg-[var(--color-canvas)] text-[var(--color-text-secondary)]',
  },
};

function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AdminEventsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: fetchAdminCategories,
  });

  const eventsQuery = useQuery({
    queryKey: ['admin', 'events', page, search, categoryId, status],
    queryFn: () =>
      fetchAdminEvents({
        page,
        limit: 12,
        search: search.trim() || undefined,
        categoryId: categoryId || undefined,
        status: status || undefined,
      }),
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicateAdminEvent,
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      void navigate(`/admin/kegiatan/${created.id}/edit`);
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal menduplikasi kegiatan.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminEvent,
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Kegiatan draft berhasil dihapus.' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal menghapus kegiatan.',
      });
    },
  });

  const items = eventsQuery.data?.items ?? [];
  const total = eventsQuery.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 12));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-primary-forest)]">Daftar Kegiatan</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Kelola jadwal, flyer, periode pengisian, periode unduh, validasi kehadiran, dan
            publikasi kegiatan.
          </p>
        </div>

        <Link
          to="/admin/kegiatan/baru"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-sm font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Buat Kegiatan</span>
        </Link>
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

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama atau kode kegiatan..."
              aria-label="Cari kegiatan"
              className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] pr-3 pl-9 text-sm"
            />
          </div>

          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            aria-label="Filter kategori"
            className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
          >
            <option value="">Semua Kategori</option>
            {(categoriesQuery.data ?? []).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Filter status"
            className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
          >
            <option value="">Semua Status</option>
            <option value="draft">Draft</option>
            <option value="published">Dipublikasikan</option>
            <option value="closed">Ditutup</option>
            <option value="archived">Diarsipkan</option>
          </select>
        </div>
      </section>

      {eventsQuery.isPending ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Memuat daftar kegiatan...</p>
      ) : eventsQuery.isError ? (
        <p className="text-sm text-[var(--color-danger)]">Gagal memuat daftar kegiatan.</p>
      ) : items.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <p className="text-base font-semibold text-[var(--color-text-primary)]">
            Belum ada kegiatan
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Mulai dengan membuat kegiatan baru untuk mengatur periode sertifikat dan flyer.
          </p>
          <Link
            to="/admin/kegiatan/baru"
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-sm font-semibold text-[var(--color-surface)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Buat Kegiatan Pertama</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((event) => {
            const badge = LIFECYCLE_LABELS[event.lifecycleStatus] ?? LIFECYCLE_LABELS.draft!;
            return (
              <article
                key={event.id}
                className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                <div className="aspect-video w-full bg-[var(--color-canvas)]">
                  {event.flyerUrl ? (
                    <img
                      src={event.flyerUrl}
                      alt={`Flyer ${event.title}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[var(--color-text-secondary)]">
                      <ImageIcon className="h-8 w-8 opacity-40" aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[var(--color-primary-green)]">
                      {event.categoryName}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.style}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <h2 className="mt-2 line-clamp-2 text-base font-semibold text-[var(--color-text-primary)]">
                    {event.title}
                  </h2>

                  <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                    <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="tabular-nums">{formatShortDate(event.eventStartAt)}</span>
                    <span>·</span>
                    <span className="font-mono">{event.eventCode}</span>
                  </div>

                  <p className="tabular-nums mt-1 text-xs text-[var(--color-text-secondary)]">
                    Peserta: {event.participantCount}
                    {event.quota !== null ? ` / ${event.quota}` : ' (tanpa kuota)'}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-3">
                    <Link
                      to={`/admin/kegiatan/${event.id}/edit`}
                      className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-3 text-xs font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)]"
                    >
                      <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Kelola</span>
                    </Link>

                    <button
                      type="button"
                      disabled={duplicateMutation.isPending}
                      onClick={() => duplicateMutation.mutate(event.id)}
                      title="Duplikasi kegiatan"
                      className="inline-flex min-h-[38px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-2.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-canvas)]"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    {event.lifecycleStatus === 'draft' && (
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Hapus draft "${event.title}"?`)) {
                            deleteMutation.mutate(event.id);
                          }
                        }}
                        title="Hapus draft"
                        className="inline-flex min-h-[38px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-2.5 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="tabular-nums text-xs text-[var(--color-text-secondary)]">
            Halaman {page} dari {totalPages} ({total} kegiatan)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="min-h-[38px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="min-h-[38px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
