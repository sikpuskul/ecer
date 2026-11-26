import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, KeyRound, Plus, UserCheck, UserX } from 'lucide-react';
import {
  ApiClientError,
  createAdminUserApi,
  fetchAdminUsers,
  resetAdminPasswordApi,
  updateAdminUserApi,
} from '@/lib/api-client';

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: fetchAdminUsers,
  });

  const createMutation = useMutation({
    mutationFn: createAdminUserApi,
    onSuccess: () => {
      setUsername('');
      setDisplayName('');
      setPassword('');
      setFeedback({ type: 'success', text: 'Akun administrator baru berhasil ditambahkan.' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal menambah administrator.',
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateAdminUserApi(id, { isActive }),
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Status administrator berhasil diperbarui.' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal memperbarui status.',
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      resetAdminPasswordApi(id, newPassword),
    onSuccess: () => {
      setResetTargetId(null);
      setResetPassword('');
      setFeedback({
        type: 'success',
        text: 'Password berhasil direset dan seluruh sesi aktif akun tersebut telah dicabut.',
      });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal mereset password.',
      });
    },
  });

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    createMutation.mutate({
      username: username.trim(),
      displayName: displayName.trim(),
      password,
    });
  }

  function handleResetSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resetTargetId) return;
    setFeedback(null);
    resetMutation.mutate({ id: resetTargetId, newPassword: resetPassword });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-primary-forest)]">
          Manajemen Administrator
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Seluruh administrator memiliki hak akses yang setara. Akun administrator aktif terakhir
          tidak dapat dinonaktifkan.
        </p>
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

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Tambah Administrator Baru
        </h2>
        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="new-username" className="block text-sm font-medium">
              Username
            </label>
            <input
              id="new-username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="mis. admin_program"
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
            />
          </div>
          <div>
            <label htmlFor="new-display-name" className="block text-sm font-medium">
              Nama Tampilan
            </label>
            <input
              id="new-display-name"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nama lengkap admin"
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
            />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium">
              Password Awal (min. 12 karakter)
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 12 karakter"
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-sm font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{createMutation.isPending ? 'Menyimpan...' : 'Tambah Administrator'}</span>
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Daftar Administrator
        </h2>

        {usersQuery.isPending ? (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">Memuat daftar akun...</p>
        ) : usersQuery.isError ? (
          <p className="mt-4 text-sm text-[var(--color-danger)]">Gagal memuat daftar akun.</p>
        ) : (
          <div className="mt-4 divide-y divide-[var(--color-border)]">
            {usersQuery.data.map((user) => (
              <div key={user.id} className="py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {user.displayName}
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.isActive
                            ? 'bg-[var(--color-accent-mint)] text-[var(--color-primary-forest)]'
                            : 'bg-[var(--color-canvas)] text-[var(--color-text-secondary)]'
                        }`}
                      >
                        {user.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      @{user.username}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setResetTargetId(resetTargetId === user.id ? null : user.id);
                        setResetPassword('');
                      }}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-canvas)]"
                    >
                      <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reset Password</span>
                    </button>

                    <button
                      type="button"
                      disabled={toggleActiveMutation.isPending}
                      onClick={() =>
                        toggleActiveMutation.mutate({ id: user.id, isActive: !user.isActive })
                      }
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-canvas)]"
                    >
                      {user.isActive ? (
                        <>
                          <UserX
                            className="h-3.5 w-3.5 text-[var(--color-danger)]"
                            aria-hidden="true"
                          />
                          <span>Nonaktifkan</span>
                        </>
                      ) : (
                        <>
                          <UserCheck
                            className="h-3.5 w-3.5 text-[var(--color-success)]"
                            aria-hidden="true"
                          />
                          <span>Aktifkan</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {resetTargetId === user.id && (
                  <form
                    onSubmit={handleResetSubmit}
                    className="mt-3 flex flex-col gap-2 rounded-[var(--radius-md)] bg-[var(--color-canvas)] p-3 sm:flex-row sm:items-center"
                  >
                    <input
                      type="password"
                      required
                      minLength={12}
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="Password baru (min. 12 karakter)"
                      className="min-h-[44px] flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base"
                    />
                    <button
                      type="submit"
                      disabled={resetMutation.isPending}
                      className="min-h-[44px] rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-xs font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)]"
                    >
                      {resetMutation.isPending ? 'Menyimpan...' : 'Simpan Password'}
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
