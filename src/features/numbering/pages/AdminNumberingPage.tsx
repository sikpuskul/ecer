import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Hash, Plus } from 'lucide-react';
import type { ResetStrategy } from '@shared/schemas/numbering';
import type { TemplateDocumentType } from '@shared/schemas/templates';
import { formatDocumentNumber } from '@shared/utils/numbering';
import { getCurrentJakartaMonthYear } from '@shared/utils/jakarta-date';
import { ApiClientError } from '@/lib/api-client';
import { createNumberingRule, fetchNumberingRules } from '@/features/certificates/api';

export function AdminNumberingPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState<TemplateDocumentType>('certificate');
  const [formatPattern, setFormatPattern] = useState('{SEQ}/SERT/{ORG_CODE}/{MONTH_ROMAN}/{YEAR}');
  const [sequencePadding, setSequencePadding] = useState(3);
  const [startingNumber, setStartingNumber] = useState(1);
  const [resetStrategy, setResetStrategy] = useState<ResetStrategy>('yearly');
  const [organizationCode, setOrganizationCode] = useState('PKM-SMK');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const rulesQuery = useQuery({
    queryKey: ['admin', 'numbering'],
    queryFn: fetchNumberingRules,
  });

  const createMutation = useMutation({
    mutationFn: createNumberingRule,
    onSuccess: () => {
      setName('');
      setFeedback({ type: 'success', text: 'Aturan penomoran baru berhasil dibuat.' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'numbering'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal membuat aturan penomoran.',
      });
    },
  });

  const now = getCurrentJakartaMonthYear();
  const livePreview = formatDocumentNumber({
    formatPattern: formatPattern || '{SEQ}',
    sequenceNumber: startingNumber,
    sequencePadding,
    documentType,
    eventCode: 'KDR-2026',
    organizationCode: organizationCode || 'PKM-SMK',
    month: now.month,
    year: now.year,
  });

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    createMutation.mutate({
      name: name.trim(),
      documentType,
      formatPattern: formatPattern.trim(),
      sequencePadding,
      startingNumber,
      resetStrategy,
      organizationCode: organizationCode.trim(),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-primary-forest)]">
          Pengaturan Penomoran Dokumen
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Token tersedia:{' '}
          <code className="text-xs">
            {'{SEQ}'} {'{EVENT_CODE}'} {'{DOC_TYPE}'} {'{MONTH}'} {'{MONTH_ROMAN}'} {'{YEAR}'}{' '}
            {'{ORG_CODE}'}
          </code>
          . Counter dialokasikan secara atomik dan tidak pernah digunakan ulang.
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
        <h2 className="text-base font-semibold">Tambah Aturan Penomoran</h2>
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="num-name" className="block text-sm font-medium">
              Nama Aturan *
            </label>
            <input
              id="num-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Penomoran Sertifikat 2026"
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
            />
          </div>

          <div>
            <label htmlFor="num-type" className="block text-sm font-medium">
              Jenis Dokumen
            </label>
            <select
              id="num-type"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as TemplateDocumentType)}
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base"
            >
              <option value="certificate">Sertifikat</option>
              <option value="award">Piagam</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="num-pattern" className="block text-sm font-medium">
              Pola Format *
            </label>
            <input
              id="num-pattern"
              type="text"
              required
              value={formatPattern}
              onChange={(e) => setFormatPattern(e.target.value)}
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 font-mono text-sm"
            />
          </div>

          <div>
            <label htmlFor="num-pad" className="block text-sm font-medium">
              Digit Padding ({sequencePadding} digit)
            </label>
            <input
              id="num-pad"
              type="number"
              min={1}
              max={8}
              value={sequencePadding}
              onChange={(e) => setSequencePadding(Number(e.target.value) || 3)}
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
            />
          </div>

          <div>
            <label htmlFor="num-start" className="block text-sm font-medium">
              Nomor Awal
            </label>
            <input
              id="num-start"
              type="number"
              min={1}
              value={startingNumber}
              onChange={(e) => setStartingNumber(Number(e.target.value) || 1)}
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
            />
          </div>

          <div>
            <label htmlFor="num-reset" className="block text-sm font-medium">
              Strategi Reset Counter
            </label>
            <select
              id="num-reset"
              value={resetStrategy}
              onChange={(e) => setResetStrategy(e.target.value as ResetStrategy)}
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base"
            >
              <option value="yearly">Tahunan (yearly)</option>
              <option value="monthly">Bulanan (monthly)</option>
              <option value="per_event">Per Kegiatan (per_event)</option>
              <option value="never">Tidak Pernah Reset (never)</option>
            </select>
          </div>

          <div>
            <label htmlFor="num-org" className="block text-sm font-medium">
              Kode Instansi ({'{ORG_CODE}'})
            </label>
            <input
              id="num-org"
              type="text"
              value={organizationCode}
              onChange={(e) => setOrganizationCode(e.target.value)}
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 font-mono text-base"
            />
          </div>

          <div className="rounded-[var(--radius-md)] bg-[var(--color-canvas)] p-4 sm:col-span-2">
            <p className="text-xs font-medium text-[var(--color-text-secondary)]">
              Preview Hasil Nomor
            </p>
            <p className="tabular-nums mt-1 font-mono text-base font-bold text-[var(--color-primary-forest)]">
              {livePreview}
            </p>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-sm font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Simpan Aturan Penomoran</span>
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="text-base font-semibold">Daftar Aturan Tersimpan</h2>
        {rulesQuery.isPending ? (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">Memuat aturan...</p>
        ) : (rulesQuery.data ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            Belum ada aturan penomoran.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-[var(--color-border)]">
            {(rulesQuery.data ?? []).map((rule) => (
              <div
                key={rule.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <Hash
                      className="h-3.5 w-3.5 text-[var(--color-primary-green)]"
                      aria-hidden="true"
                    />
                    <span>{rule.name}</span>
                  </p>
                  <p className="font-mono text-xs text-[var(--color-text-secondary)]">
                    {rule.formatPattern}
                  </p>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {rule.documentType} · reset: {rule.resetStrategy}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
