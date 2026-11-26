import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, FileText, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import type { TemplateDocumentType } from '@shared/schemas/templates';
import { ApiClientError } from '@/lib/api-client';
import { deleteAdminTemplate, fetchAdminTemplates, importAdminTemplate } from '../api';

export function AdminTemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState<TemplateDocumentType>('certificate');
  const [googleDocsUrl, setGoogleDocsUrl] = useState('');
  const [description, setDescription] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const templatesQuery = useQuery({
    queryKey: ['admin', 'templates'],
    queryFn: fetchAdminTemplates,
  });

  const importMutation = useMutation({
    mutationFn: importAdminTemplate,
    onSuccess: (res) => {
      setName('');
      setGoogleDocsUrl('');
      setDescription('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'templates'] });
      void navigate(`/admin/template/${res.template.id}`);
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal mengimpor template Google Docs.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminTemplate,
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Template berhasil dihapus.' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'templates'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal menghapus template.',
      });
    },
  });

  function handleImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    importMutation.mutate({
      name: name.trim(),
      documentType,
      googleDocsUrl: googleDocsUrl.trim(),
      description: description.trim(),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-primary-forest)]">
          Library Template Google Docs
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Impor template Google Docs menggunakan placeholder{' '}
          <code className="rounded bg-[var(--color-surface)] px-1 text-xs">{'{{snake_case}}'}</code>
          . Template bersifat reusable dan berversi snapshot.
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
          Impor Template Baru
        </h2>
        <form onSubmit={handleImport} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tpl-name" className="block text-sm font-medium">
              Nama Template *
            </label>
            <input
              id="tpl-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Sertifikat Pelatihan Kader 2026"
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
            />
          </div>

          <div>
            <label htmlFor="tpl-type" className="block text-sm font-medium">
              Jenis Dokumen *
            </label>
            <select
              id="tpl-type"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as TemplateDocumentType)}
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base"
            >
              <option value="certificate">Sertifikat (Peserta / Narasumber / Panitia)</option>
              <option value="award">Piagam Penghargaan (Khusus Admin)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="tpl-url" className="block text-sm font-medium">
              URL Google Docs *
            </label>
            <input
              id="tpl-url"
              type="url"
              required
              value={googleDocsUrl}
              onChange={(e) => setGoogleDocsUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/.../edit"
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="tpl-desc" className="block text-sm font-medium">
              Keterangan (Opsional)
            </label>
            <input
              id="tpl-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={importMutation.isPending}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-sm font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>
                {importMutation.isPending
                  ? 'Membaca Google Docs...'
                  : 'Impor & Ekstrak Placeholder'}
              </span>
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Daftar Template Tersimpan
        </h2>

        {templatesQuery.isPending ? (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">Memuat template...</p>
        ) : templatesQuery.isError ? (
          <p className="mt-4 text-sm text-[var(--color-danger)]">Gagal memuat template.</p>
        ) : templatesQuery.data.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            Belum ada template yang diimpor.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-[var(--color-border)]">
            {templatesQuery.data.map((tpl) => (
              <div
                key={tpl.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText
                      className="h-4 w-4 shrink-0 text-[var(--color-primary-green)]"
                      aria-hidden="true"
                    />
                    <Link
                      to={`/admin/template/${tpl.id}`}
                      className="text-sm font-semibold text-[var(--color-primary-forest)] hover:underline"
                    >
                      {tpl.name}
                    </Link>
                    <span className="rounded-full bg-[var(--color-canvas)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                      {tpl.documentType === 'award' ? 'Piagam' : 'Sertifikat'}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        tpl.latestVersion?.validationStatus === 'valid'
                          ? 'bg-[var(--color-accent-mint)] text-[var(--color-primary-forest)]'
                          : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                      }`}
                    >
                      v{tpl.latestVersion?.versionNumber ?? 0} ·{' '}
                      {tpl.latestVersion?.validationStatus ?? 'pending'}
                    </span>
                  </div>
                  <p className="tabular-nums mt-1 text-xs text-[var(--color-text-secondary)]">
                    {tpl.latestVersion?.placeholders.length ?? 0} placeholder terdeteksi
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/admin/template/${tpl.id}`}
                    className="inline-flex min-h-[38px] items-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-xs font-semibold hover:bg-[var(--color-canvas)]"
                  >
                    Konfigurasi
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Hapus template "${tpl.name}"?`)) {
                        deleteMutation.mutate(tpl.id);
                      }
                    }}
                    className="inline-flex min-h-[38px] items-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-2.5 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                    title="Hapus template"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
