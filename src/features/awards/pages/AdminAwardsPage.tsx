import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Ban,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Mail,
  Medal,
  RefreshCw,
  Upload,
  Users,
} from 'lucide-react';
import { DEFAULT_AWARD_CATEGORIES } from '@shared/schemas/awards';
import { parseAwardsCsv } from '@shared/utils/csv-awards';
import { formatJakartaDate } from '@shared/utils/jakarta-date';
import { ApiClientError } from '@/lib/api-client';
import { regenerateDocumentApi, revokeDocumentApi } from '@/features/certificates/api';
import { resendDocumentEmailApi } from '@/features/email/api';
import { fetchAdminParticipants } from '@/features/public-dashboard/api';
import {
  bulkImportAwardsApi,
  createManualAwardApi,
  fetchAdminAwards,
  fetchAwardTemplateOptions,
  importAwardsFromParticipantsApi,
} from '../api';

type IssueTab = 'manual' | 'csv' | 'participants';

export function AdminAwardsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<IssueTab>('manual');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  // Manual form state
  const [recipientName, setRecipientName] = useState('');
  const [awardCategory, setAwardCategory] = useState<string>(DEFAULT_AWARD_CATEGORIES[0]);
  const [institution, setInstitution] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  // CSV bulk state
  const [csvText, setCsvText] = useState('');

  // Participant import state
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [participantCategory, setParticipantCategory] = useState<string>(
    DEFAULT_AWARD_CATEGORIES[3],
  );
  const [participantNotes, setParticipantNotes] = useState('');

  const templatesQuery = useQuery({
    queryKey: ['admin', 'award-templates'],
    queryFn: fetchAwardTemplateOptions,
  });

  const awardsQuery = useQuery({
    queryKey: ['admin', 'awards', statusFilter],
    queryFn: () =>
      fetchAdminAwards({
        page: 1,
        limit: 30,
        status: statusFilter || undefined,
      }),
  });

  const selectedOption = useMemo(() => {
    const options = templatesQuery.data ?? [];
    if (!selectedTemplateKey && options.length > 0) return options[0]!;
    return options.find((o) => o.eventTemplateId === selectedTemplateKey) ?? null;
  }, [templatesQuery.data, selectedTemplateKey]);

  const participantsQuery = useQuery({
    queryKey: ['admin', 'award-participants', selectedOption?.eventId],
    queryFn: () =>
      fetchAdminParticipants({
        eventId: selectedOption!.eventId,
        page: 1,
        limit: 100,
      }),
    enabled: activeTab === 'participants' && Boolean(selectedOption?.eventId),
  });

  const csvPreview = useMemo(() => {
    if (!csvText.trim()) return null;
    return parseAwardsCsv(csvText);
  }, [csvText]);

  const manualMutation = useMutation({
    mutationFn: createManualAwardApi,
    onSuccess: (res) => {
      setFeedback({
        type: 'success',
        text: `Piagam berhasil diterbitkan dengan nomor ${res.documentNumber} dan masuk antrean PDF.`,
      });
      setRecipientName('');
      setInstitution('');
      setEmail('');
      setNotes('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'awards'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal menerbitkan piagam.',
      });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: bulkImportAwardsApi,
    onSuccess: (res) => {
      setFeedback({
        type: 'success',
        text: `${res.issuedCount} piagam berhasil diimport dan dimasukkan ke antrean penerbitan PDF.`,
      });
      setCsvText('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'awards'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal melakukan bulk import piagam.',
      });
    },
  });

  const importParticipantsMutation = useMutation({
    mutationFn: importAwardsFromParticipantsApi,
    onSuccess: (res) => {
      setFeedback({
        type: 'success',
        text: `${res.issuedCount} piagam diterbitkan dari peserta terdaftar${res.skippedCount > 0 ? ` (${res.skippedCount} dilewati karena sudah ada/tidak lengkap)` : ''}.`,
      });
      setSelectedParticipantIds([]);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'awards'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal import piagam dari peserta.',
      });
    },
  });

  const regenMutation = useMutation({
    mutationFn: regenerateDocumentApi,
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Job regenerasi piagam berhasil dibuat.' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'awards'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal meregenerate piagam.',
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => revokeDocumentApi(id, reason),
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Piagam telah dicabut.' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'awards'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal mencabut piagam.',
      });
    },
  });

  const resendEmailMutation = useMutation({
    mutationFn: resendDocumentEmailApi,
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Email piagam dijadwalkan untuk dikirim.' });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal mengirim email piagam.',
      });
    },
  });

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedOption) {
      setFeedback({
        type: 'error',
        text: 'Belum ada template bertipe Piagam yang ditautkan pada kegiatan.',
      });
      return;
    }
    manualMutation.mutate({
      eventId: selectedOption.eventId,
      eventTemplateId: selectedOption.eventTemplateId,
      recipientName,
      awardCategory,
      institution,
      email,
      notes,
    });
  };

  const handleCsvFileUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const toggleParticipant = (id: string) => {
    setSelectedParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-primary-forest)]">
          Manajemen Piagam Penghargaan
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Penerbitan piagam khusus administrator (terpisah dari pencarian publik dan statistik
          sertifikat bulanan). Mendukung input manual, import CSV maks. 100 baris, dan import dari
          peserta kegiatan.
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

      {/* Issuance Panel */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'manual', label: 'Terbitkan Manual', icon: Medal },
                { id: 'csv', label: 'Import CSV (Maks 100)', icon: FileSpreadsheet },
                { id: 'participants', label: 'Import dari Peserta', icon: Users },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] border px-3.5 text-xs font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'border-[var(--color-primary-green)] bg-[var(--color-accent-mint)]/50 text-[var(--color-primary-forest)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Event & Award Template Selector */}
        <div>
          <label
            htmlFor="awardTemplateSelect"
            className="block text-xs font-semibold text-[var(--color-text-primary)]"
          >
            Kegiatan &amp; Template Piagam <span className="text-[var(--color-danger)]">*</span>
          </label>
          {(templatesQuery.data ?? []).length === 0 ? (
            <p className="mt-1.5 rounded-[var(--radius-md)] border border-[var(--color-warning)]/25 bg-[var(--color-warning-bg)] p-3 text-xs text-[var(--color-warning)]">
              Belum ada template bertipe Piagam (award) yang ditautkan pada kegiatan. Tautkan
              template piagam terlebih dahulu di menu Kegiatan → Formulir &amp; Template.
            </p>
          ) : (
            <select
              id="awardTemplateSelect"
              value={selectedOption?.eventTemplateId ?? ''}
              onChange={(e) => {
                setSelectedTemplateKey(e.target.value);
                setSelectedParticipantIds([]);
              }}
              className="mt-1.5 min-h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
            >
              {(templatesQuery.data ?? []).map((opt) => (
                <option key={opt.eventTemplateId} value={opt.eventTemplateId}>
                  {opt.eventTitle} — {opt.templateName} ({opt.eventCode})
                </option>
              ))}
            </select>
          )}
        </div>

        {activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="awardName" className="block text-xs font-semibold">
                Nama Penerima <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                id="awardName"
                type="text"
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="dr. Budi Santoso"
                className="mt-1 min-h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm"
              />
            </div>

            <div>
              <label htmlFor="awardCategory" className="block text-xs font-semibold">
                Kategori Penghargaan / Peran <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                id="awardCategory"
                type="text"
                list="award-category-suggestions"
                required
                value={awardCategory}
                onChange={(e) => setAwardCategory(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm"
              />
              <datalist id="award-category-suggestions">
                {DEFAULT_AWARD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="awardInst" className="block text-xs font-semibold">
                Instansi / Unit Kerja
              </label>
              <input
                id="awardInst"
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Puskesmas Sumbermanjing Kulon"
                className="mt-1 min-h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm"
              />
            </div>

            <div>
              <label htmlFor="awardEmail" className="block text-xs font-semibold">
                Email Penerima (Opsional)
              </label>
              <input
                id="awardEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="mt-1 min-h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="awardNotes" className="block text-xs font-semibold">
                Keterangan Tambahan (Opsional)
              </label>
              <input
                id="awardNotes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Atas kontribusi sebagai narasumber lokakarya"
                className="mt-1 min-h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={manualMutation.isPending || !selectedOption}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-5 text-sm font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)] disabled:opacity-50"
              >
                <Medal className="h-4 w-4" aria-hidden="true" />
                <span>{manualMutation.isPending ? 'Menerbitkan...' : 'Terbitkan Piagam'}</span>
              </button>
            </div>
          </form>
        )}

        {activeTab === 'csv' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[var(--color-text-secondary)]">
                Format kolom wajib: <code>nama_lengkap,kategori_penghargaan</code> (opsional:{' '}
                <code>instansi,email,keterangan</code>). Maksimal 100 baris/batch; karakter formula
                spreadsheet otomatis disanitasi.
              </p>
              <label className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-xs font-semibold hover:bg-[var(--color-canvas)]">
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Pilih File CSV</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleCsvFileUpload(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={
                'nama_lengkap,kategori_penghargaan,instansi,email\nSiti Aminah,Narasumber,Dinas Kesehatan,siti@example.com'
              }
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 font-mono text-xs"
            />

            {csvPreview && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-canvas)] p-3.5 text-xs space-y-2">
                <p className="font-semibold text-[var(--color-primary-forest)]">
                  Pratinjau CSV: {csvPreview.rows.length} baris valid, {csvPreview.errors.length}{' '}
                  baris error
                </p>
                {csvPreview.errors.length > 0 && (
                  <ul className="list-disc pl-5 text-[var(--color-danger)]">
                    {csvPreview.errors.slice(0, 5).map((err) => (
                      <li key={`${err.line}-${err.message}`}>
                        Baris {err.line}: {err.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button
              type="button"
              disabled={
                bulkMutation.isPending ||
                !selectedOption ||
                !csvPreview ||
                csvPreview.rows.length === 0 ||
                csvPreview.errors.length > 0
              }
              onClick={() => {
                if (!selectedOption || !csvPreview) return;
                bulkMutation.mutate({
                  eventId: selectedOption.eventId,
                  eventTemplateId: selectedOption.eventTemplateId,
                  rows: csvPreview.rows,
                });
              }}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-5 text-sm font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)] disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              <span>
                {bulkMutation.isPending
                  ? 'Mengimport...'
                  : `Import & Terbitkan (${csvPreview?.rows.length ?? 0} Baris)`}
              </span>
            </button>
          </div>
        )}

        {activeTab === 'participants' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="partAwardCat" className="block text-xs font-semibold">
                  Kategori Penghargaan <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  id="partAwardCat"
                  type="text"
                  list="award-category-suggestions"
                  value={participantCategory}
                  onChange={(e) => setParticipantCategory(e.target.value)}
                  className="mt-1 min-h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="partAwardNotes" className="block text-xs font-semibold">
                  Keterangan (Opsional)
                </label>
                <input
                  id="partAwardNotes"
                  type="text"
                  value={participantNotes}
                  onChange={(e) => setParticipantNotes(e.target.value)}
                  className="mt-1 min-h-[42px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm"
                />
              </div>
            </div>

            {participantsQuery.isPending ? (
              <p className="text-xs text-[var(--color-text-secondary)]">Memuat daftar peserta...</p>
            ) : (participantsQuery.data?.items ?? []).length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)]">
                Belum ada peserta terdaftar pada kegiatan ini.
              </p>
            ) : (
              <div className="max-h-60 divide-y divide-[var(--color-border)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
                {(participantsQuery.data?.items ?? []).map((p) => {
                  const displayName = String(
                    p.data.nama_lengkap ?? p.data.nama ?? p.id.slice(0, 8),
                  );
                  const checked = selectedParticipantIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 text-xs hover:bg-[var(--color-canvas)]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleParticipant(p.id)}
                        className="h-4 w-4 accent-[var(--color-primary-green)]"
                      />
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {displayName}
                      </span>
                      <span className="text-[var(--color-text-secondary)]">
                        ({p.submissionStatus})
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              disabled={
                importParticipantsMutation.isPending ||
                !selectedOption ||
                selectedParticipantIds.length === 0 ||
                !participantCategory.trim()
              }
              onClick={() => {
                if (!selectedOption) return;
                importParticipantsMutation.mutate({
                  eventId: selectedOption.eventId,
                  eventTemplateId: selectedOption.eventTemplateId,
                  participantIds: selectedParticipantIds,
                  awardCategory: participantCategory.trim(),
                  notes: participantNotes.trim(),
                });
              }}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-5 text-sm font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)] disabled:opacity-50"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>
                {importParticipantsMutation.isPending
                  ? 'Menerbitkan...'
                  : `Terbitkan untuk ${selectedParticipantIds.length} Peserta`}
              </span>
            </button>
          </div>
        )}
      </section>

      {/* Issued Awards List */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-[var(--color-primary-forest)]">
            Daftar Piagam Terbit
          </h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter status piagam"
            className="min-h-[40px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs"
          >
            <option value="">Semua Status</option>
            <option value="ready">Ready</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>

        {awardsQuery.isPending ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Memuat daftar piagam...</p>
        ) : (awardsQuery.data?.items ?? []).length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Belum ada piagam penghargaan yang diterbitkan.
          </p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {(awardsQuery.data?.items ?? []).map((award) => (
              <div
                key={award.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{award.recipientName}</p>
                    <span className="rounded-full bg-[var(--color-accent-mint)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-primary-forest)]">
                      {award.awardCategory}
                    </span>
                    <span className="rounded-full bg-[var(--color-canvas)] px-2.5 py-0.5 font-mono text-xs">
                      {award.documentNumber}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {award.documentStatus} · rev {award.revisionCount}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {award.eventTitle}
                    {award.institution ? ` · ${award.institution}` : ''} · Terbit:{' '}
                    {formatJakartaDate(award.issuedAt, true)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/verifikasi/${encodeURIComponent(award.verificationCode)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2.5 text-xs font-semibold hover:bg-[var(--color-canvas)]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>QR</span>
                  </a>

                  {award.documentStatus === 'ready' && (
                    <>
                      <a
                        href={`/api/v1/admin/documents/${encodeURIComponent(award.id)}/download`}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-3 text-xs font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)]"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>PDF</span>
                      </a>
                      <button
                        type="button"
                        disabled={resendEmailMutation.isPending}
                        onClick={() => resendEmailMutation.mutate(award.id)}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2.5 text-xs font-semibold hover:bg-[var(--color-canvas)]"
                      >
                        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Email</span>
                      </button>
                    </>
                  )}

                  {award.documentStatus !== 'revoked' && (
                    <>
                      <button
                        type="button"
                        disabled={regenMutation.isPending}
                        onClick={() => regenMutation.mutate(award.id)}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2.5 text-xs font-semibold hover:bg-[var(--color-canvas)]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Regen</span>
                      </button>
                      <button
                        type="button"
                        disabled={revokeMutation.isPending}
                        onClick={() => {
                          const reason = window.prompt(
                            `Masukkan alasan pencabutan piagam ${award.documentNumber} (min. 5 karakter):`,
                          );
                          if (reason && reason.trim().length >= 5) {
                            revokeMutation.mutate({ id: award.id, reason: reason.trim() });
                          }
                        }}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2.5 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                      >
                        <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Cabut</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
