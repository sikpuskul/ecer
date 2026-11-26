import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Plus, Save } from 'lucide-react';
import type { SettingKey } from '@shared/schemas/admin';
import {
  ApiClientError,
  createAdminCategoryApi,
  fetchAdminCategories,
  fetchAdminSettings,
  updateAdminCategoryApi,
  updateAdminSettingsApi,
} from '@/lib/api-client';

export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<Record<SettingKey, string>>({
    organization_name: '',
    organization_code: '',
    contact_email: '',
    contact_phone: '',
    public_verification_mask_name: 'true',
    privacy_notice_version: '1.0',
  });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: fetchAdminSettings,
  });

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: fetchAdminCategories,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setFormState(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  const saveSettingsMutation = useMutation({
    mutationFn: updateAdminSettingsApi,
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Pengaturan aplikasi berhasil disimpan.' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal menyimpan pengaturan.',
      });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: createAdminCategoryApi,
    onSuccess: () => {
      setNewCategoryName('');
      setFeedback({ type: 'success', text: 'Kategori kegiatan baru berhasil ditambahkan.' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal menambah kategori.',
      });
    },
  });

  const toggleCategoryMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateAdminCategoryApi(id, { isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
    },
  });

  function handleSaveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    saveSettingsMutation.mutate(formState);
  }

  function handleAddCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setFeedback(null);
    createCategoryMutation.mutate({ name: newCategoryName.trim() });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-primary-forest)]">
          Pengaturan &amp; Kategori Kegiatan
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Pengaturan umum non-secret dan daftar kategori kegiatan yang ditampilkan pada editor serta
          filter publik.
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
          Identitas Instansi &amp; Privasi
        </h2>

        {settingsQuery.isPending ? (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">Memuat pengaturan...</p>
        ) : (
          <form
            onSubmit={handleSaveSettings}
            className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div>
              <label htmlFor="org-name" className="block text-sm font-medium">
                Nama Instansi
              </label>
              <input
                id="org-name"
                type="text"
                value={formState.organization_name}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, organization_name: e.target.value }))
                }
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
              />
            </div>

            <div>
              <label htmlFor="org-code" className="block text-sm font-medium">
                Kode Instansi (Token {'{ORG_CODE}'})
              </label>
              <input
                id="org-code"
                type="text"
                value={formState.organization_code}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, organization_code: e.target.value }))
                }
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
              />
            </div>

            <div>
              <label htmlFor="contact-email" className="block text-sm font-medium">
                Email Kontak Panitia
              </label>
              <input
                id="contact-email"
                type="email"
                value={formState.contact_email}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, contact_email: e.target.value }))
                }
                placeholder="kontak@puskesmas.go.id"
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
              />
            </div>

            <div>
              <label htmlFor="contact-phone" className="block text-sm font-medium">
                Telepon / WhatsApp Informasi
              </label>
              <input
                id="contact-phone"
                type="tel"
                value={formState.contact_phone}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, contact_phone: e.target.value }))
                }
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
              />
            </div>

            <div>
              <label htmlFor="mask-name" className="block text-sm font-medium">
                Masking Nama di Halaman Verifikasi QR
              </label>
              <select
                id="mask-name"
                value={formState.public_verification_mask_name}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    public_verification_mask_name: e.target.value,
                  }))
                }
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base"
              >
                <option value="true">Aktif — Samarkan sebagian nama (Disarankan)</option>
                <option value="false">Nonaktif — Tampilkan nama lengkap</option>
              </select>
            </div>

            <div>
              <label htmlFor="privacy-ver" className="block text-sm font-medium">
                Versi Pemberitahuan Privasi
              </label>
              <input
                id="privacy-ver"
                type="text"
                value={formState.privacy_notice_version}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, privacy_notice_version: e.target.value }))
                }
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saveSettingsMutation.isPending}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-sm font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)] disabled:opacity-60"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>{saveSettingsMutation.isPending ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Kategori Kegiatan
        </h2>

        <form onSubmit={handleAddCategory} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nama kategori baru (mis. Penyuluhan Gizi)"
            aria-label="Nama kategori kegiatan baru"
            className="min-h-[44px] flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
          />
          <button
            type="submit"
            disabled={createCategoryMutation.isPending}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-sm font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Tambah Kategori</span>
          </button>
        </form>

        {categoriesQuery.isPending ? (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">Memuat kategori...</p>
        ) : categoriesQuery.isError ? (
          <p className="mt-4 text-sm text-[var(--color-danger)]">Gagal memuat kategori.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--color-border)]">
            {categoriesQuery.data.map((cat) => (
              <li key={cat.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{cat.name}</p>
                  <p className="font-mono text-xs text-[var(--color-text-secondary)]">{cat.slug}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    toggleCategoryMutation.mutate({ id: cat.id, isActive: !cat.isActive })
                  }
                  className={`inline-flex min-h-[36px] items-center rounded-full px-3 text-xs font-medium ${
                    cat.isActive
                      ? 'bg-[var(--color-accent-mint)] text-[var(--color-primary-forest)]'
                      : 'bg-[var(--color-canvas)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  {cat.isActive ? 'Aktif' : 'Nonaktif'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
