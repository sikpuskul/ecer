import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  MapPin,
  RotateCcw,
  Search,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import {
  formatJakartaDate,
  formatMonthYearId,
  getCurrentJakartaMonthYear,
  stepMonth,
} from '@shared/utils/jakarta-date';
import { fetchPublicDashboard, fetchPublicEvents } from '../api';

const STATE_BADGES: Record<string, { label: string; style: string }> = {
  upcoming: {
    label: 'Pengisian belum dibuka',
    style: 'bg-[var(--color-canvas)] text-[var(--color-text-secondary)]',
  },
  active: {
    label: 'Sedang Dibuka',
    style: 'bg-[var(--color-accent-mint)] text-[var(--color-primary-forest)]',
  },
  registration_closed: {
    label: 'Pengisian Ditutup · Unduh Tersedia',
    style: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  },
  quota_full: {
    label: 'Kuota Penuh',
    style: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  },
  closed: {
    label: 'Kegiatan telah ditutup',
    style: 'bg-[var(--color-canvas)] text-[var(--color-text-secondary)]',
  },
  archived: {
    label: 'Arsip Kegiatan',
    style: 'bg-[var(--color-canvas)] text-[var(--color-text-secondary)]',
  },
};

export function PublicDashboardPage() {
  const current = getCurrentJakartaMonthYear();
  const [searchParams, setSearchParams] = useSearchParams();

  const monthParam = Number.parseInt(searchParams.get('month') ?? '', 10);
  const yearParam = Number.parseInt(searchParams.get('year') ?? '', 10);
  const month =
    Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : current.month;
  const year =
    Number.isFinite(yearParam) && yearParam >= 2020 && yearParam <= 2100 ? yearParam : current.year;

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  function setMonthYear(nextMonth: number, nextYear: number) {
    setSearchParams({ month: String(nextMonth), year: String(nextYear) });
  }

  const statsQuery = useQuery({
    queryKey: ['public', 'dashboard', month, year],
    queryFn: () => fetchPublicDashboard(month, year),
  });

  const eventsQuery = useQuery({
    queryKey: ['public', 'events', month, year, search, categoryId, statusFilter],
    queryFn: () =>
      fetchPublicEvents({
        month,
        year,
        search: search.trim() || undefined,
        categoryId: categoryId || undefined,
        status: statusFilter || undefined,
      }),
  });

  const isCurrentMonth = month === current.month && year === current.year;
  const hasFilters = Boolean(search.trim() || categoryId || statusFilter);

  return (
    <div className="space-y-6">
      {/* Compact Header & Month/Year Navigation */}
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-primary-forest)] sm:text-3xl">
            Sertifikat Kegiatan Digital
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--color-text-secondary)] sm:text-[15px]">
            Pilih kegiatan Puskesmas Sumbermanjing Kulon untuk mengisi data sertifikat atau mencari
            sertifikat Anda tanpa perlu membuat akun.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
            <button
              type="button"
              onClick={() => {
                const prev = stepMonth(month, year, -1);
                setMonthYear(prev.month, prev.year);
              }}
              aria-label="Bulan sebelumnya"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-primary)] hover:bg-[var(--color-canvas)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="tabular-nums min-w-[140px] px-3 text-center text-sm font-semibold text-[var(--color-primary-forest)]">
              {formatMonthYearId(month, year)}
            </span>
            <button
              type="button"
              onClick={() => {
                const next = stepMonth(month, year, 1);
                setMonthYear(next.month, next.year);
              }}
              aria-label="Bulan berikutnya"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-primary)] hover:bg-[var(--color-canvas)]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => setMonthYear(current.month, current.year)}
              className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-xs font-semibold text-[var(--color-primary-forest)] hover:bg-[var(--color-canvas)]"
            >
              Bulan ini
            </button>
          )}
        </div>
      </section>

      {/* 3 Monthly Statistics Indicators (PRD §7.3) */}
      <section aria-label="Statistik bulanan" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
            Kegiatan Dipublikasikan
          </p>
          <p className="tabular-nums mt-1.5 text-2xl font-bold text-[var(--color-primary-forest)]">
            {statsQuery.data?.publishedEvents ?? 0}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Pada bulan {formatMonthYearId(month, year)}
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
            Kegiatan Sedang Aktif
          </p>
          <p className="tabular-nums mt-1.5 text-2xl font-bold text-[var(--color-primary-green)]">
            {statsQuery.data?.activeEvents ?? 0}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Menerima pengisian atau pengunduhan
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
            Sertifikat Terbit
          </p>
          <p className="tabular-nums mt-1.5 text-2xl font-bold text-[var(--color-primary-forest)]">
            {statsQuery.data?.certificatesIssued ?? 0}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Sertifikat aktif bulan terpilih (tidak termasuk piagam)
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama kegiatan..."
              aria-label="Cari nama kegiatan"
              className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] pr-3 pl-9 text-base sm:text-sm"
            />
          </div>

          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label="Filter jenis kegiatan"
            className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base sm:text-sm"
          >
            <option value="">Semua Jenis Kegiatan</option>
            {(statsQuery.data?.categories ?? []).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter status kegiatan"
              className="min-h-[44px] flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base sm:text-sm"
            >
              <option value="">Semua Status</option>
              <option value="active">Sedang Dibuka</option>
              <option value="upcoming">Akan Datang</option>
              <option value="registration_closed">Unduh Saja</option>
              <option value="closed">Ditutup</option>
            </select>

            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCategoryId('');
                  setStatusFilter('');
                }}
                title="Reset filter"
                aria-label="Reset filter"
                className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)]"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Event Cards Grid */}
      {eventsQuery.isPending ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Memuat daftar kegiatan...</p>
      ) : eventsQuery.isError ? (
        <div
          role="alert"
          className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger-bg)] p-5 text-sm text-[var(--color-danger)]"
        >
          Gagal memuat daftar kegiatan. Silakan muat ulang halaman.
        </div>
      ) : eventsQuery.data.items.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <p className="text-base font-semibold text-[var(--color-text-primary)]">
            Tidak ada kegiatan pada {formatMonthYearId(month, year)}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Gunakan navigasi bulan di atas atau ubah kata kunci pencarian untuk melihat kegiatan
            lainnya.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {eventsQuery.data.items.map((event) => {
            const badge = STATE_BADGES[event.eligibility.computedState] ?? STATE_BADGES.closed!;
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

                <div className="flex flex-1 flex-col p-5">
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

                  <h2 className="mt-2.5 text-base font-semibold leading-snug text-[var(--color-text-primary)]">
                    {event.title}
                  </h2>

                  <div className="mt-3 space-y-1.5 text-xs text-[var(--color-text-secondary)]">
                    <p className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="tabular-nums">
                        {formatJakartaDate(event.eventStartAt)}
                        {event.eventEndAt !== event.eventStartAt
                          ? ` – ${formatJakartaDate(event.eventEndAt)}`
                          : ''}
                      </span>
                    </p>
                    {event.location && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{event.location}</span>
                      </p>
                    )}
                    {event.quota !== null && (
                      <p className="tabular-nums">
                        Kuota: {event.participantCount} / {event.quota} peserta
                      </p>
                    )}
                  </div>

                  <div className="mt-5 flex flex-col gap-2 border-t border-[var(--color-border)] pt-4">
                    {event.eligibility.canRegister ? (
                      <Link
                        to={`/kegiatan/${event.slug}/daftar`}
                        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-sm font-semibold text-[var(--color-surface)] transition-colors hover:bg-[var(--color-primary-forest)]"
                      >
                        Isi Data Sertifikat
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex min-h-[44px] w-full cursor-not-allowed items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-canvas)] px-4 text-sm font-semibold text-[var(--color-text-secondary)]"
                      >
                        {event.eligibility.computedState === 'upcoming'
                          ? 'Pengisian belum dibuka'
                          : event.eligibility.computedState === 'quota_full'
                            ? 'Kuota peserta penuh'
                            : 'Pengisian tidak tersedia'}
                      </button>
                    )}

                    {event.eligibility.canDownload ? (
                      <Link
                        to={`/kegiatan/${event.slug}/cari`}
                        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-primary-green)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-primary-forest)] transition-colors hover:bg-[var(--color-accent-mint)]/40"
                      >
                        Cari Sertifikat
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex min-h-[42px] w-full cursor-not-allowed items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-xs font-semibold text-[var(--color-text-secondary)]"
                      >
                        Unduh sertifikat belum tersedia
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
