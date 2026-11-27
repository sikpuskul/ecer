import { LogIn, ShieldCheck } from 'lucide-react';
import { Link, Outlet } from 'react-router';

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)] text-[var(--color-text-primary)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[var(--radius-md)] focus:bg-[var(--color-primary-forest)] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-[var(--color-surface)]"
      >
        Lewati ke konten utama
      </a>
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-forest)] text-[var(--color-surface)]"
              aria-hidden="true"
            >
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold leading-tight tracking-tight text-[var(--color-primary-forest)]">
                ECER
              </p>
              <p className="truncate text-xs text-[var(--color-text-secondary)]">
                Puskesmas Sumbermanjing Kulon
              </p>
            </div>
          </Link>

          <nav aria-label="Navigasi publik" className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="hidden min-h-[40px] items-center rounded-[var(--radius-md)] px-3 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary-forest)] sm:inline-flex"
            >
              Kegiatan
            </Link>
            <Link
              to="/admin/login"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm font-semibold text-[var(--color-primary-forest)] transition-colors hover:bg-[var(--color-canvas)]"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              <span>Admin</span>
            </Link>
          </nav>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8"
      >
        <Outlet />
      </main>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-[var(--color-text-secondary)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>ECER — Sertifikat dan Piagam Digital · Puskesmas Sumbermanjing Kulon</p>
          <p>Zona waktu: Asia/Jakarta (WIB)</p>
        </div>
      </footer>
    </div>
  );
}
