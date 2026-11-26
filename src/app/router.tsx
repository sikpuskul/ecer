import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { PublicHomePage } from '@/features/public-home/PublicHomePage';

const AdminLoginPage = lazy(() =>
  import('@/features/authentication/pages/AdminLoginPage').then((m) => ({
    default: m.AdminLoginPage,
  })),
);

const AdminLayout = lazy(() =>
  import('@/layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })),
);

const AdminDashboardPage = lazy(() =>
  import('@/features/admin-dashboard/pages/AdminDashboardPage').then((m) => ({
    default: m.AdminDashboardPage,
  })),
);

const AdminUsersPage = lazy(() =>
  import('@/features/users/pages/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
);

const AdminSettingsPage = lazy(() =>
  import('@/features/settings/pages/AdminSettingsPage').then((m) => ({
    default: m.AdminSettingsPage,
  })),
);

const AdminAuditLogPage = lazy(() =>
  import('@/features/audit-log/pages/AdminAuditLogPage').then((m) => ({
    default: m.AdminAuditLogPage,
  })),
);

const AdminEventsListPage = lazy(() =>
  import('@/features/events/pages/AdminEventsListPage').then((m) => ({
    default: m.AdminEventsListPage,
  })),
);

const AdminEventEditorPage = lazy(() =>
  import('@/features/events/pages/AdminEventEditorPage').then((m) => ({
    default: m.AdminEventEditorPage,
  })),
);

const AdminTemplatesPage = lazy(() =>
  import('@/features/templates/pages/AdminTemplatesPage').then((m) => ({
    default: m.AdminTemplatesPage,
  })),
);

const AdminTemplateDetailPage = lazy(() =>
  import('@/features/templates/pages/AdminTemplateDetailPage').then((m) => ({
    default: m.AdminTemplateDetailPage,
  })),
);

const AdminFormBuilderPage = lazy(() =>
  import('@/features/form-builder/pages/AdminFormBuilderPage').then((m) => ({
    default: m.AdminFormBuilderPage,
  })),
);

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <p className="text-sm text-[var(--color-text-secondary)]">Memuat halaman...</p>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<PublicHomePage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="kegiatan" element={<AdminEventsListPage />} />
            <Route path="kegiatan/baru" element={<AdminEventEditorPage />} />
            <Route path="kegiatan/:id/edit" element={<AdminEventEditorPage />} />
            <Route path="kegiatan/:id/formulir" element={<AdminFormBuilderPage />} />
            <Route path="template" element={<AdminTemplatesPage />} />
            <Route path="template/:id" element={<AdminTemplateDetailPage />} />
            <Route path="pengguna" element={<AdminUsersPage />} />
            <Route path="pengaturan" element={<AdminSettingsPage />} />
            <Route path="audit-log" element={<AdminAuditLogPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
