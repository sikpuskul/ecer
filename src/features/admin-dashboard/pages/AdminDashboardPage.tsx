import { useQuery } from '@tanstack/react-query';
import { AlertCircle, FileClock, Settings, Users } from 'lucide-react';
import { Link } from 'react-router';
import { fetchAdminDashboard } from '@/lib/api-client';

function formatWib(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AdminDashboardPage() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: fetchAdminDashboard,
  });

  if (isPending) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">Memuat ringkasan dashboard...</p>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger-bg)] p-5 text-sm text-[var(--color-danger)]"
      >
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <span>Gagal memuat dashboard administrator</span>
        </div>
        <p className="mt-1">{error instanceof Error ? error.message : 'Terjadi kesalahan.'}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 inline-flex min-h-[40px] items-center rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-xs font-semibold text-[var(--color-surface)]"
        >
          Muat Ulang
        </button>
      </div>
    );
  }

  const { summary, recentActivities } = data;

  const primaryMetrics = [
    {
      label: 'Total Kegiatan',
      value: summary.totalEvents,
      note: `${summary.activeEvents} dipublikasikan`,
    },
    {
      label: 'Total Peserta',
      value: summary.totalParticipants,
      note: `${summary.pendingApprovals} menunggu approval`,
    },
    {
      label: 'Sertifikat Terbit',
      value: summary.certificatesIssued,
      note: `${summary.awardsIssued} piagam terbit`,
    },
    {
      label: 'Administrator Aktif',
      value: summary.activeAdmins,
      note: `${summary.activeCategories} kategori aktif`,
    },
  ];

  return (
    <div className="space-y-6">
      <section aria-labelledby="summary-heading">
        <h1 id="summary-heading" className="text-xl font-bold text-[var(--color-primary-forest)]">
          Ringkasan Operasional
        </h1>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {primaryMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                {metric.label}
              </p>
              <p className="tabular-nums mt-2 text-2xl font-bold text-[var(--color-primary-forest)]">
                {metric.value}
              </p>
              <p className="tabular-nums mt-1 text-xs text-[var(--color-text-secondary)]">
                {metric.note}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="quick-actions-heading"
        className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6"
      >
        <h2
          id="quick-actions-heading"
          className="text-base font-semibold text-[var(--color-text-primary)]"
        >
          Akses Cepat Inti (Phase 2)
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            to="/admin/pengguna"
            className="flex min-h-[48px] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-primary-green)] hover:bg-[var(--color-canvas)]"
          >
            <Users className="h-4 w-4 text-[var(--color-primary-green)]" aria-hidden="true" />
            <span>Kelola Administrator</span>
          </Link>
          <Link
            to="/admin/pengaturan"
            className="flex min-h-[48px] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-primary-green)] hover:bg-[var(--color-canvas)]"
          >
            <Settings className="h-4 w-4 text-[var(--color-primary-green)]" aria-hidden="true" />
            <span>Pengaturan &amp; Kategori</span>
          </Link>
          <Link
            to="/admin/audit-log"
            className="flex min-h-[48px] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-primary-green)] hover:bg-[var(--color-canvas)]"
          >
            <FileClock className="h-4 w-4 text-[var(--color-primary-green)]" aria-hidden="true" />
            <span>Lihat Audit Log</span>
          </Link>
        </div>
      </section>

      <section
        aria-labelledby="recent-activity-heading"
        className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
          <h2
            id="recent-activity-heading"
            className="text-base font-semibold text-[var(--color-text-primary)]"
          >
            Aktivitas Terbaru
          </h2>
          <Link
            to="/admin/audit-log"
            className="text-xs font-semibold text-[var(--color-primary-green)] hover:text-[var(--color-primary-forest)]"
          >
            Lihat semua
          </Link>
        </div>

        {recentActivities.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            Belum ada aktivitas tercatat.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {recentActivities.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    <span className="font-mono text-xs text-[var(--color-primary-forest)]">
                      {item.action}
                    </span>{' '}
                    · {item.entityType}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Oleh {item.adminUsername ? `@${item.adminUsername}` : item.actorType}
                  </p>
                </div>
                <time className="tabular-nums text-xs text-[var(--color-text-secondary)]">
                  {formatWib(item.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
