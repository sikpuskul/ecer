import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileClock,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { ApiClientError, fetchCurrentAdmin, logoutAdminApi } from '@/lib/api-client';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/kegiatan', label: 'Kegiatan', icon: CalendarDays },
  { to: '/admin/template', label: 'Template Docs', icon: FileText },
  { to: '/admin/pengguna', label: 'Administrator', icon: Users },
  { to: '/admin/pengaturan', label: 'Pengaturan & Kategori', icon: Settings },
  { to: '/admin/audit-log', label: 'Audit Log', icon: FileClock },
];

const ROUTE_TITLES: Record<string, string> = {
  '/admin': 'Dashboard Administrator',
  '/admin/kegiatan': 'Manajemen Kegiatan',
  '/admin/kegiatan/baru': 'Buat Kegiatan Baru',
  '/admin/template': 'Library Template Google Docs',
  '/admin/pengguna': 'Manajemen Administrator',
  '/admin/pengaturan': 'Pengaturan & Kategori Kegiatan',
  '/admin/audit-log': 'Riwayat Audit Log',
};

export function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const authQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentAdmin,
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: logoutAdminApi,
    onSettled: () => {
      queryClient.clear();
      void navigate('/admin/login', { replace: true });
    },
  });

  if (authQuery.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Memeriksa sesi administrator...
        </p>
      </div>
    );
  }

  if (authQuery.isError) {
    const isUnauthorized =
      authQuery.error instanceof ApiClientError && authQuery.error.status === 401;
    if (isUnauthorized) {
      return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-4">
        <div className="max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
          <p className="text-base font-semibold text-[var(--color-danger)]">
            Gagal memuat sesi administrator
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {authQuery.error instanceof Error
              ? authQuery.error.message
              : 'Terjadi gangguan koneksi ke server.'}
          </p>
          <button
            type="button"
            onClick={() => void authQuery.refetch()}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-sm font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)]"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const admin = authQuery.data;
  const currentTitle = ROUTE_TITLES[location.pathname] ?? 'Panel Administrator';

  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)] text-[var(--color-text-primary)]">
      {/* Desktop Sidebar */}
      <aside
        aria-label="Navigasi Administrator"
        className={`hidden shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-[width] duration-200 lg:flex ${
          sidebarCollapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[var(--color-border)] px-4">
          <Link to="/admin" className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-forest)] text-[var(--color-surface)]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <p className="text-sm font-bold leading-tight text-[var(--color-primary-forest)]">
                  ECER Admin
                </p>
                <p className="truncate text-[11px] text-[var(--color-text-secondary)]">
                  PKM Sumbermanjing Kulon
                </p>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-primary-forest)]"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? 'bg-[var(--color-accent-mint)] text-[var(--color-primary-forest)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-text-primary)]'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-[var(--color-border)] p-3">
          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!sidebarCollapsed && <span>{logoutMutation.isPending ? 'Keluar...' : 'Keluar'}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-[var(--color-primary-forest)]/40"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative z-50 flex w-72 max-w-[85vw] flex-col bg-[var(--color-surface)] shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-[var(--color-border)] px-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-forest)] text-[var(--color-surface)]">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <span className="text-sm font-bold text-[var(--color-primary-forest)]">
                  ECER Admin
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Tutup menu"
                className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={({ isActive }) =>
                      `flex min-h-[44px] items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium ${
                        isActive
                          ? 'bg-[var(--color-accent-mint)] text-[var(--color-primary-forest)]'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)]'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
            <div className="border-t border-[var(--color-border)] p-3">
              <button
                type="button"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Buka menu navigasi"
              className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-primary)] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[var(--color-primary-forest)]">
                {currentTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-[var(--color-text-primary)]">
                {admin.displayName}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">@{admin.username}</p>
            </div>
            <Link
              to="/"
              className="inline-flex min-h-[38px] items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-text-primary)]"
            >
              Beranda Publik
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
