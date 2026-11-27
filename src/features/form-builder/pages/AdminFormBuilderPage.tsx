import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Eye, Link2, Plus, Save, Send, Trash2 } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { FORM_FIELD_TYPES, type FormField, type FormFieldType } from '@shared/schemas/forms';
import { ApiClientError } from '@/lib/api-client';
import { fetchNumberingRules } from '@/features/certificates/api';
import {
  fetchAdminTemplates,
  fetchEventForm,
  fetchEventTemplateLinks,
  publishEventForm,
  saveEventFormDraft,
  saveEventTemplateLinks,
} from '@/features/templates/api';

function createDefaultFields(): FormField[] {
  return [
    {
      id: crypto.randomUUID(),
      fieldKey: 'nama_lengkap',
      label: 'Nama Lengkap',
      inputType: 'text',
      source: 'participant_input',
      description: 'Tulis nama lengkap beserta gelar sesuai yang diinginkan pada sertifikat.',
      placeholder: 'Contoh: dr. Siti Aminah',
      required: true,
      unique: false,
      searchable: false,
      sensitive: false,
      options: [],
      defaultValue: '',
      sortOrder: 0,
      isActive: true,
    },
    {
      id: crypto.randomUUID(),
      fieldKey: 'nomor_peserta',
      label: 'Nomor Peserta / Registrasi',
      inputType: 'text',
      source: 'additional',
      description: 'Digunakan sebagai kunci unik dan pencarian sertifikat.',
      placeholder: 'Masukkan nomor peserta',
      required: true,
      unique: true,
      searchable: true,
      sensitive: false,
      options: [],
      defaultValue: '',
      sortOrder: 1,
      isActive: true,
    },
    {
      id: crypto.randomUUID(),
      fieldKey: 'email',
      label: 'Alamat Email',
      inputType: 'email',
      source: 'additional',
      description: 'Opsional untuk menerima salinan PDF sertifikat dan OTP pemulihan.',
      placeholder: 'nama@email.com',
      required: false,
      unique: false,
      searchable: false,
      sensitive: true,
      options: [],
      defaultValue: '',
      sortOrder: 2,
      isActive: true,
    },
  ];
}

export function AdminFormBuilderPage() {
  const { id: eventId } = useParams();
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<FormField[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedTplVersionId, setSelectedTplVersionId] = useState('');
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const formQuery = useQuery({
    queryKey: ['admin', 'event-form', eventId],
    queryFn: () => fetchEventForm(eventId!),
    enabled: Boolean(eventId),
  });

  const linksQuery = useQuery({
    queryKey: ['admin', 'event-templates', eventId],
    queryFn: () => fetchEventTemplateLinks(eventId!),
    enabled: Boolean(eventId),
  });

  const templatesQuery = useQuery({
    queryKey: ['admin', 'templates'],
    queryFn: fetchAdminTemplates,
  });

  const rulesQuery = useQuery({
    queryKey: ['admin', 'numbering-rules'],
    queryFn: fetchNumberingRules,
  });

  const saveLinksMutation = useMutation({
    mutationFn: (
      nextLinks: Array<{
        templateVersionId: string;
        numberingRuleId?: string;
        categoryName: string;
        sortOrder: number;
        isActive: boolean;
      }>,
    ) => saveEventTemplateLinks(eventId!, nextLinks),
    onSuccess: () => {
      setFeedback({
        type: 'success',
        text: 'Tautan template dokumen & aturan penomoran berhasil disimpan.',
      });
      setSelectedTplVersionId('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'event-templates', eventId] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal menyimpan tautan template.',
      });
    },
  });

  useEffect(() => {
    if (!formQuery.data) return;
    const latest = formQuery.data.draft ?? formQuery.data.published;
    setFields(latest ? latest.fields : createDefaultFields());
  }, [formQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveEventFormDraft(
        eventId!,
        fields.map((f, idx) => ({ ...f, sortOrder: idx })),
      ),
    onSuccess: (saved) => {
      setFeedback({
        type: 'success',
        text: `Draft formulir v${saved.versionNumber} berhasil disimpan.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'event-form', eventId] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal menyimpan draft formulir.',
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => publishEventForm(eventId!),
    onSuccess: (published) => {
      setFeedback({
        type: 'success',
        text: `Formulir versi v${published.versionNumber} berhasil dipublikasikan.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'event-form', eventId] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal memublikasikan formulir.',
      });
    },
  });

  function updateField(index: number, patch: Partial<FormField>) {
    setFields((prev) => prev.map((f, idx) => (idx === index ? { ...f, ...patch } : f)));
  }

  function addField() {
    const nextIdx = fields.length + 1;
    setFields((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        fieldKey: `field_${nextIdx}`,
        label: `Field ${nextIdx}`,
        inputType: 'text',
        source: 'additional',
        description: '',
        placeholder: '',
        required: false,
        unique: false,
        searchable: false,
        sensitive: false,
        options: [],
        defaultValue: '',
        sortOrder: prev.length,
        isActive: true,
      },
    ]);
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, idx) => idx !== index));
  }

  if (formQuery.isPending) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">Memuat konfigurasi formulir...</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to={`/admin/kegiatan/${eventId}/edit`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary-forest)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Kembali ke Editor Kegiatan</span>
          </Link>
          <h1 className="mt-1 text-xl font-bold text-[var(--color-primary-forest)]">
            Dynamic Form Builder — {formQuery.data?.eventTitle}
          </h1>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            Versi terpublikasi:{' '}
            {formQuery.data?.published ? `v${formQuery.data.published.versionNumber}` : 'Belum ada'}{' '}
            · Draft:{' '}
            {formQuery.data?.draft ? `v${formQuery.data.draft.versionNumber}` : 'Tidak ada'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-xs font-semibold hover:bg-[var(--color-canvas)]"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{previewMode ? 'Kembali ke Editor' : 'Preview Formulir'}</span>
          </button>

          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-xs font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)]"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{saveMutation.isPending ? 'Menyimpan...' : 'Simpan Draft'}</span>
          </button>

          <button
            type="button"
            disabled={publishMutation.isPending || !formQuery.data?.draft}
            onClick={() => publishMutation.mutate()}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-primary-green)] px-4 text-xs font-semibold text-[var(--color-primary-forest)] hover:bg-[var(--color-accent-mint)] disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Publikasikan Versi</span>
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

      {/* Template & Numbering Rule Linking Section */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--color-primary-forest)]">
            <Link2 className="h-4 w-4" aria-hidden="true" />
            <span>Template Dokumen &amp; Aturan Penomoran</span>
          </h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            Tautkan minimal 1 template Sertifikat agar sistem dapat menerbitkan nomor dan PDF
            otomatis untuk peserta.
          </p>
        </div>

        {(linksQuery.data ?? []).length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-[var(--color-warning)]/25 bg-[var(--color-warning-bg)] p-3 text-xs text-[var(--color-warning)]">
            Belum ada template dokumen yang ditautkan pada kegiatan ini.
          </p>
        ) : (
          <div className="divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
            {(linksQuery.data ?? []).map((link, idx) => {
              const matchedTpl = (templatesQuery.data ?? []).find(
                (t) => t.latestVersion?.id === link.templateVersionId,
              );
              const matchedRule = (rulesQuery.data ?? []).find(
                (r) => r.id === link.numberingRuleId,
              );
              return (
                <div
                  key={link.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {matchedTpl
                        ? `${matchedTpl.name} (${matchedTpl.documentType})`
                        : link.categoryName}
                    </span>
                    <span className="ml-2 text-[var(--color-text-secondary)]">
                      Penomoran: {matchedRule ? matchedRule.name : link.numberingRuleId.slice(0, 8)}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={saveLinksMutation.isPending}
                    onClick={() => {
                      const remaining = (linksQuery.data ?? [])
                        .filter((_, i) => i !== idx)
                        .map((item, i) => ({
                          templateVersionId: item.templateVersionId,
                          numberingRuleId: item.numberingRuleId,
                          categoryName: item.categoryName,
                          sortOrder: i,
                          isActive: item.isActive,
                        }));
                      saveLinksMutation.mutate(remaining);
                    }}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2.5 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                    <span>Lepas</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select
            value={selectedTplVersionId}
            onChange={(e) => setSelectedTplVersionId(e.target.value)}
            aria-label="Pilih template dokumen"
            className="min-h-[40px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs"
          >
            <option value="">Pilih Template Google Docs...</option>
            {(templatesQuery.data ?? [])
              .filter((t) => Boolean(t.latestVersion))
              .map((t) => (
                <option key={t.id} value={t.latestVersion!.id}>
                  {t.name} ({t.documentType === 'award' ? 'Piagam' : 'Sertifikat'} · v
                  {t.latestVersion!.versionNumber})
                </option>
              ))}
          </select>

          <select
            value={selectedRuleId}
            onChange={(e) => setSelectedRuleId(e.target.value)}
            aria-label="Pilih aturan penomoran"
            className="min-h-[40px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs"
          >
            <option value="">Aturan Penomoran Default...</option>
            {(rulesQuery.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.formatPattern})
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={saveLinksMutation.isPending || !selectedTplVersionId}
            onClick={() => {
              const tpl = (templatesQuery.data ?? []).find(
                (t) => t.latestVersion?.id === selectedTplVersionId,
              );
              const existing = (linksQuery.data ?? []).map((item, i) => ({
                templateVersionId: item.templateVersionId,
                numberingRuleId: item.numberingRuleId,
                categoryName: item.categoryName,
                sortOrder: i,
                isActive: item.isActive,
              }));
              saveLinksMutation.mutate([
                ...existing,
                {
                  templateVersionId: selectedTplVersionId,
                  numberingRuleId: selectedRuleId || undefined,
                  categoryName: tpl?.name ?? 'Sertifikat',
                  sortOrder: existing.length,
                  isActive: true,
                },
              ]);
            }}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-xs font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)] disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tautkan Template</span>
          </button>
        </div>
      </section>

      {previewMode ? (
        <section className="mx-auto max-w-xl rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h2 className="text-lg font-bold text-[var(--color-primary-forest)]">
            Preview Formulir Peserta
          </h2>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Tampilan mobile-first seperti yang akan dilihat peserta.
          </p>
          <div className="mt-5 space-y-4">
            {fields
              .filter((f) => f.isActive)
              .map((f) => (
                <div key={f.id}>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                    {f.label}
                    {f.required && <span className="ml-1 text-[var(--color-danger)]">*</span>}
                  </label>
                  {f.description && (
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      {f.description}
                    </p>
                  )}
                  {f.inputType === 'textarea' ? (
                    <textarea
                      disabled
                      placeholder={f.placeholder}
                      className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-canvas)] p-3 text-base"
                    />
                  ) : f.inputType === 'select' ? (
                    <select
                      disabled
                      className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 text-base"
                    >
                      <option>Pilih {f.label}</option>
                      {f.options.map((opt) => (
                        <option key={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      disabled
                      type={f.inputType === 'nik' ? 'text' : f.inputType}
                      placeholder={f.placeholder || (f.inputType === 'nik' ? '16 digit NIK' : '')}
                      className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 text-base"
                    />
                  )}
                </div>
              ))}
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <section
              key={field.id}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    Label Field *
                  </label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                    className="mt-1 min-h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    Field Key (snake_case) *
                  </label>
                  <input
                    type="text"
                    value={field.fieldKey}
                    onChange={(e) =>
                      updateField(index, {
                        fieldKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                      })
                    }
                    className="mt-1 min-h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    Tipe Input
                  </label>
                  <select
                    value={field.inputType}
                    onChange={(e) =>
                      updateField(index, { inputType: e.target.value as FormFieldType })
                    }
                    className="mt-1 min-h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                  >
                    {FORM_FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    Bantuan / Deskripsi
                  </label>
                  <input
                    type="text"
                    value={field.description ?? ''}
                    onChange={(e) => updateField(index, { description: e.target.value })}
                    className="mt-1 min-h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    Placeholder Input
                  </label>
                  <input
                    type="text"
                    value={field.placeholder ?? ''}
                    onChange={(e) => updateField(index, { placeholder: e.target.value })}
                    className="mt-1 min-h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(index, { required: e.target.checked })}
                    />
                    <span>Wajib diisi</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={field.unique}
                      onChange={(e) => updateField(index, { unique: e.target.checked })}
                    />
                    <span>Unique key</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={field.searchable}
                      onChange={(e) => updateField(index, { searchable: e.target.checked })}
                    />
                    <span>Searchable</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={field.sensitive}
                      onChange={(e) => updateField(index, { sensitive: e.target.checked })}
                    />
                    <span>Sensitif (PII)</span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-[var(--radius-md)] px-2.5 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Hapus</span>
                </button>
              </div>
            </section>
          ))}

          <button
            type="button"
            onClick={addField}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-primary-green)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-primary-forest)] hover:bg-[var(--color-accent-mint)]/40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Tambah Field Baru</span>
          </button>
        </div>
      )}
    </div>
  );
}
