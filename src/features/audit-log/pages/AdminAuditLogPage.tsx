import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchAuditLogs } from '@/lib/api-client';

function formatWib(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AdminAuditLogPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const limit = 20;

  const auditQuery = useQuery({
    queryKey: ['admin', 'audit-logs', page, entityType],
    queryFn: () => fetchAuditLogs({ page, limit, entityType: entityType || undefined }),
  });

  const total = auditQuery.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-primary-forest)]">
            Riwayat Audit Log
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Catatan aktivitas administratif bersifat read-only dan tidak menyimpan data pribadi
            sensitif maupun secret.
          </p>
        </div>

        <div className="w-full sm:w-56">
          <label htmlFor="audit-entity-filter" className="block text-xs font-medium">
            Filter Entitas
          </label>
          <select
            id="audit-entity-filter"
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
            className="mt-1 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
          >
            <option value="">Semua Entitas</option>
            <option value="admin_session">Sesi Admin</option>
            <option value="admin">Akun Admin</option>
            <option value="app_settings">Pengaturan</option>
            <option value="event_category">Kategori Kegiatan</option>
          </select>
        </div>
      </div>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        {auditQuery.isPending ? (
          <p className="p-6 text-sm text-[var(--color-text-secondary)]">Memuat audit log...</p>
        ) : auditQuery.isError ? (
          <p className="p-6 text-sm text-[var(--color-danger)]">Gagal memuat audit log.</p>
        ) : auditQuery.data.items.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-text-secondary)]">
            Belum ada entri audit log yang sesuai filter.
          </p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {auditQuery.data.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[var(--color-accent-mint)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--color-primary-forest)]">
                      {item.action}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {item.entityType} · {item.entityId.slice(0, 12)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Aktor: {item.adminUsername ? `@${item.adminUsername}` : item.actorType} · Req:{' '}
                    <span className="font-mono">{item.requestId.slice(0, 8)}</span>
                  </p>
                </div>

                <time className="tabular-nums shrink-0 text-xs text-[var(--color-text-secondary)]">
                  {formatWib(item.createdAt)}
                </time>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-3">
          <p className="tabular-nums text-xs text-[var(--color-text-secondary)]">
            Halaman {page} dari {totalPages} ({total} entri)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Halaman sebelumnya"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Halaman berikutnya"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
