import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, CheckCircle2, Play, RefreshCw, Save } from 'lucide-react';
import { Link, useParams } from 'react-router';
import {
  PLACEHOLDER_SOURCES,
  type PlaceholderMappingEntry,
  type PlaceholderSource,
} from '@shared/schemas/templates';
import { ApiClientError } from '@/lib/api-client';
import {
  fetchAdminTemplateDetail,
  refreshAdminTemplate,
  testGenerateAdminTemplate,
  updateAdminTemplate,
  validateAdminTemplate,
} from '../api';

export function AdminTemplateDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [mappings, setMappings] = useState<PlaceholderMappingEntry[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const detailQuery = useQuery({
    queryKey: ['admin', 'template', id],
    queryFn: () => fetchAdminTemplateDetail(id!),
    enabled: Boolean(id),
  });

  useEffect(() => {
    const latest = detailQuery.data?.template.latestVersion;
    if (latest) {
      setMappings(latest.mappings);
    }
  }, [detailQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateAdminTemplate(id!, { mappings }),
    onSuccess: (res) => {
      setFeedback({ type: 'success', text: 'Mapping placeholder berhasil disimpan.' });
      void queryClient.setQueryData(['admin', 'template', id], res);
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal menyimpan mapping.',
      });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshAdminTemplate(id!),
    onSuccess: (res) => {
      setFeedback({
        type: 'success',
        text: `Template berhasil di-refresh ke versi v${res.template.latestVersion?.versionNumber}.`,
      });
      void queryClient.setQueryData(['admin', 'template', id], {
        template: res.template,
        versions: res.versions,
      });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal refresh template.',
      });
    },
  });

  const validateMutation = useMutation({
    mutationFn: () => validateAdminTemplate(id!),
    onSuccess: (res) => {
      setFeedback({
        type: 'success',
        text: 'Template tervalidasi dan snapshot privat Google Docs berhasil dibuat.',
      });
      void queryClient.setQueryData(['admin', 'template', id], res);
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Validasi & snapshot gagal.',
      });
    },
  });

  const testGenMutation = useMutation({
    mutationFn: () => testGenerateAdminTemplate(id!),
    onSuccess: (res) => {
      setFeedback({
        type: 'success',
        text: `Test PDF dummy berhasil dibuat (${res.filename}, ${(res.fileSize / 1024).toFixed(1)} KiB). Tidak menggunakan nomor produksi.`,
      });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Test generation gagal.',
      });
    },
  });

  if (detailQuery.isPending) {
    return <p className="text-sm text-[var(--color-text-secondary)]">Memuat detail template...</p>;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <p className="text-sm text-[var(--color-danger)]">Template tidak ditemukan.</p>;
  }

  const { template, versions } = detailQuery.data;

  function updateMapping(index: number, patch: Partial<PlaceholderMappingEntry>) {
    setMappings((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/admin/template"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary-forest)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Kembali ke Library Template</span>
          </Link>
          <h1 className="mt-1 text-xl font-bold text-[var(--color-primary-forest)]">
            {template.name}
          </h1>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            Versi aktif: v{template.latestVersion?.versionNumber ?? 0} · Status:{' '}
            <strong>{template.latestVersion?.validationStatus ?? 'pending'}</strong>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={refreshMutation.isPending}
            onClick={() => refreshMutation.mutate()}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold hover:bg-[var(--color-canvas)]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Refresh Docs</span>
          </button>

          <button
            type="button"
            disabled={validateMutation.isPending}
            onClick={() => validateMutation.mutate()}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-3.5 text-xs font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)]"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {validateMutation.isPending ? 'Membuat Snapshot...' : 'Validasi & Snapshot'}
            </span>
          </button>

          <button
            type="button"
            disabled={testGenMutation.isPending}
            onClick={() => testGenMutation.mutate()}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-primary-green)] px-3.5 text-xs font-semibold text-[var(--color-primary-forest)] hover:bg-[var(--color-accent-mint)]"
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{testGenMutation.isPending ? 'Menghasilkan...' : 'Test Dummy PDF'}</span>
          </button>
        </div>
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
        <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Mapping Placeholder ({mappings.length})
          </h2>
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-xs font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)]"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{saveMutation.isPending ? 'Menyimpan...' : 'Simpan Mapping'}</span>
          </button>
        </div>

        {mappings.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            Tidak ada placeholder terdeteksi pada dokumen Google Docs ini.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-[var(--color-border)]">
            {mappings.map((m, idx) => (
              <div
                key={m.placeholder}
                className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-3 sm:items-center"
              >
                <code className="text-xs font-semibold text-[var(--color-primary-forest)]">
                  {`{{${m.placeholder}}}`}
                </code>

                <select
                  value={m.source}
                  onChange={(e) =>
                    updateMapping(idx, { source: e.target.value as PlaceholderSource })
                  }
                  aria-label={`Sumber untuk ${m.placeholder}`}
                  className="min-h-[42px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                >
                  {PLACEHOLDER_SOURCES.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>

                {m.source === 'static_value' ? (
                  <input
                    type="text"
                    value={m.staticValue ?? ''}
                    onChange={(e) => updateMapping(idx, { staticValue: e.target.value })}
                    placeholder="Masukkan nilai statis"
                    className="min-h-[42px] rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm"
                  />
                ) : (
                  <select
                    value={m.transform ?? 'none'}
                    onChange={(e) =>
                      updateMapping(idx, {
                        transform: e.target.value as 'none' | 'uppercase' | 'titlecase',
                      })
                    }
                    className="min-h-[42px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                  >
                    <option value="none">Format asli</option>
                    <option value="uppercase">HURUF KAPITAL</option>
                    <option value="titlecase">Title Case</option>
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Riwayat Versi Template ({versions.length})
        </h2>
        <ul className="mt-3 divide-y divide-[var(--color-border)] text-sm">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between py-2.5">
              <span className="tabular-nums font-medium">
                Versi {v.versionNumber} · {v.placeholders.length} placeholder ·{' '}
                {v.snapshotDocId ? 'Snapshot tersimpan' : 'Belum snapshot'}
              </span>
              <span className="text-xs text-[var(--color-text-secondary)]">
                {v.validationStatus}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
