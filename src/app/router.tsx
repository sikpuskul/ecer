import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { PublicLayout } from '@/layouts/PublicLayout';
import { PublicDashboardPage } from '@/features/public-dashboard/pages/PublicDashboardPage';

const PublicRegisterPage = lazy(() =>
  import('@/features/registration/pages/PublicRegisterPage').then((m) => ({
    default: m.PublicRegisterPage,
  })),
);

const PublicSearchPage = lazy(() =>
  import('@/features/certificate-search/pages/PublicSearchPage').then((m) => ({
    default: m.PublicSearchPage,
  })),
);

const PublicVerifyPage = lazy(() =>
  import('@/features/verification/pages/PublicVerifyPage').then((m) => ({
    default: m.PublicVerifyPage,
  })),
);

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

const AdminParticipantsPage = lazy(() =>
  import('@/features/participants/pages/AdminParticipantsPage').then((m) => ({
    default: m.AdminParticipantsPage,
  })),
);

const AdminNumberingPage = lazy(() =>
  import('@/features/numbering/pages/AdminNumberingPage').then((m) => ({
    default: m.AdminNumberingPage,
  })),
);

const AdminCertificatesPage = lazy(() =>
  import('@/features/certificates/pages/AdminCertificatesPage').then((m) => ({
    default: m.AdminCertificatesPage,
  })),
);

const AdminJobsPage = lazy(() =>
  import('@/features/jobs/pages/AdminJobsPage').then((m) => ({
    default: m.AdminJobsPage,
  })),
);

const AdminEmailPage = lazy(() =>
  import('@/features/email/pages/AdminEmailPage').then((m) => ({
    default: m.AdminEmailPage,
  })),
);

const AdminAwardsPage = lazy(() =>
  import('@/features/awards/pages/AdminAwardsPage').then((m) => ({
    default: m.AdminAwardsPage,
  })),
);

const AdminReportsPage = lazy(() =>
  import('@/features/reports/pages/AdminReportsPage').then((m) => ({
    default: m.AdminReportsPage,
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
          <Route element={<PublicLayout />}>
            <Route path="/" element={<PublicDashboardPage />} />
            <Route path="/kegiatan/:slug/daftar" element={<PublicRegisterPage />} />
            <Route path="/kegiatan/:slug/cari" element={<PublicSearchPage />} />
            <Route path="/verifikasi/:verificationCode" element={<PublicVerifyPage />} />
          </Route>

          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="kegiatan" element={<AdminEventsListPage />} />
            <Route path="kegiatan/baru" element={<AdminEventEditorPage />} />
            <Route path="kegiatan/:id/edit" element={<AdminEventEditorPage />} />
            <Route path="kegiatan/:id/formulir" element={<AdminFormBuilderPage />} />
            <Route path="kegiatan/:id/peserta" element={<AdminParticipantsPage />} />
            <Route path="template" element={<AdminTemplatesPage />} />
            <Route path="template/:id" element={<AdminTemplateDetailPage />} />
            <Route path="sertifikat" element={<AdminCertificatesPage />} />
            <Route path="piagam" element={<AdminAwardsPage />} />
            <Route path="penomoran" element={<AdminNumberingPage />} />
            <Route path="jobs" element={<AdminJobsPage />} />
            <Route path="email" element={<AdminEmailPage />} />
            <Route path="laporan" element={<AdminReportsPage />} />
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
