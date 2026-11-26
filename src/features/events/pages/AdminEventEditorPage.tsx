import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Save,
  Send,
  Unlock,
  Upload,
  XCircle,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import type { AttendanceMode, IssuanceMode } from '@shared/schemas/events';
import { ApiClientError, fetchAdminCategories } from '@/lib/api-client';
import {
  archiveAdminEvent,
  closeAdminEvent,
  createAdminEvent,
  fetchAdminEvent,
  publishAdminEvent,
  reopenAdminEvent,
  updateAdminEvent,
  uploadEventFlyer,
} from '../api';

type EditorTab = 'info' | 'schedule' | 'validation' | 'email' | 'publish';

const TABS: Array<{ id: EditorTab; label: string }> = [
  { id: 'info', label: '1. Informasi & Flyer' },
  { id: 'schedule', label: '2. Periode & Kuota' },
  { id: 'validation', label: '3. Validasi & Penerbitan' },
  { id: 'email', label: '4. Pencarian & Email' },
  { id: 'publish', label: '5. Publikasi & Status' },
];

function isoToJakartaLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // Convert UTC date to Asia/Jakarta (+07:00) for datetime-local input
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 16);
}

function jakartaLocalInputToIso(localValue: string): string | null {
  if (!localValue.trim()) return null;
  return new Date(`${localValue}:00+07:00`).toISOString();
}

export function AdminEventEditorPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<EditorTab>('info');
  const [isDirty, setIsDirty] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  // Form state
  const [categoryId, setCategoryId] = useState('cat-pelatihan');
  const [title, setTitle] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [description, setDescription] = useState('');
  const [organizer, setOrganizer] = useState('Puskesmas Sumbermanjing Kulon');
  const [location, setLocation] = useState('');
  const [flyerKey, setFlyerKey] = useState<string | null>(null);
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null);

  const [eventStartLocal, setEventStartLocal] = useState('');
  const [eventEndLocal, setEventEndLocal] = useState('');
  const [regStartLocal, setRegStartLocal] = useState('');
  const [regEndLocal, setRegEndLocal] = useState('');
  const [dlStartLocal, setDlStartLocal] = useState('');
  const [dlEndLocal, setDlEndLocal] = useState('');
  const [quotaStr, setQuotaStr] = useState('100');

  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>('open');
  const [issuanceMode, setIssuanceMode] = useState<IssuanceMode>('auto');
  const [eventPin, setEventPin] = useState('');
  const [uniqueKeyField, setUniqueKeyField] = useState('nomor_peserta');
  const [searchKeyField, setSearchKeyField] = useState('nomor_peserta');

  const [autoSendEmail, setAutoSendEmail] = useState(true);
  const [embargoEmail, setEmbargoEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState('Sertifikat Kegiatan - {{nama_kegiatan}}');
  const [emailBody, setEmailBody] = useState(
    'Yth. {{nama_lengkap}},\n\nTerima kasih telah mengikuti kegiatan {{nama_kegiatan}} yang diselenggarakan oleh Puskesmas Sumbermanjing Kulon.\n\nSertifikat Anda terlampir dalam email ini.\n\nTerima kasih.\nPuskesmas Sumbermanjing Kulon',
  );

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: fetchAdminCategories,
  });

  const eventQuery = useQuery({
    queryKey: ['admin', 'event', id],
    queryFn: () => fetchAdminEvent(id!),
    enabled: isEditing,
  });

  useEffect(() => {
    const ev = eventQuery.data;
    if (!ev) return;
    setCategoryId(ev.categoryId);
    setTitle(ev.title);
    setEventCode(ev.eventCode);
    setDescription(ev.description);
    setOrganizer(ev.organizer);
    setLocation(ev.location);
    setFlyerKey(ev.flyerKey);
    setFlyerUrl(ev.flyerUrl);
    setEventStartLocal(isoToJakartaLocalInput(ev.eventStartAt));
    setEventEndLocal(isoToJakartaLocalInput(ev.eventEndAt));
    setRegStartLocal(isoToJakartaLocalInput(ev.registrationStartAt));
    setRegEndLocal(isoToJakartaLocalInput(ev.registrationEndAt));
    setDlStartLocal(isoToJakartaLocalInput(ev.downloadStartAt));
    setDlEndLocal(isoToJakartaLocalInput(ev.downloadEndAt));
    setQuotaStr(ev.quota !== null ? String(ev.quota) : '');
    setAttendanceMode(ev.attendanceMode);
    setIssuanceMode(ev.issuanceMode);
    setUniqueKeyField(ev.uniqueKeyField);
    setSearchKeyField(ev.searchKeyField);
    setAutoSendEmail(ev.emailConfig.autoSend);
    setEmbargoEmail(ev.emailConfig.embargoUntilDownloadStart);
    setEmailSubject(ev.emailConfig.subject);
    setEmailBody(ev.emailConfig.body);
    setEventPin('');
    setIsDirty(false);
  }, [eventQuery.data]);

  // Warn on unsaved changes before leaving browser tab (PRD §21)
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadEventFlyer(file, id),
    onSuccess: (res) => {
      setFlyerKey(res.flyerKey);
      setFlyerUrl(res.flyerUrl);
      setIsDirty(true);
      setFeedback({
        type: 'success',
        text: 'Flyer berhasil diunggah. Jangan lupa simpan perubahan.',
      });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal mengunggah flyer.',
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const eventStartIso = jakartaLocalInputToIso(eventStartLocal);
      const eventEndIso = jakartaLocalInputToIso(eventEndLocal);
      if (!eventStartIso || !eventEndIso) {
        throw new ApiClientError('Tanggal mulai dan selesai kegiatan wajib diisi.', 422);
      }

      const parsedQuota = quotaStr.trim() ? Number.parseInt(quotaStr.trim(), 10) : null;
      const payload = {
        categoryId,
        title: title.trim(),
        eventCode: eventCode.trim() || undefined,
        description,
        organizer: organizer.trim(),
        location: location.trim(),
        flyerKey,
        eventStartAt: eventStartIso,
        eventEndAt: eventEndIso,
        registrationStartAt: jakartaLocalInputToIso(regStartLocal),
        registrationEndAt: jakartaLocalInputToIso(regEndLocal),
        downloadStartAt: jakartaLocalInputToIso(dlStartLocal),
        downloadEndAt: jakartaLocalInputToIso(dlEndLocal),
        quota: parsedQuota,
        attendanceMode,
        issuanceMode,
        uniqueKeyField: uniqueKeyField.trim(),
        searchKeyField: searchKeyField.trim(),
        ...(eventPin.trim() ? { eventPin: eventPin.trim() } : {}),
        emailConfig: {
          autoSend: autoSendEmail,
          embargoUntilDownloadStart: embargoEmail,
          subject: emailSubject,
          body: emailBody,
        },
      };

      if (isEditing && id) {
        return updateAdminEvent(id, payload);
      }
      return createAdminEvent(payload);
    },
    onSuccess: (saved) => {
      setIsDirty(false);
      setEventPin('');
      setFeedback({ type: 'success', text: 'Perubahan kegiatan berhasil disimpan.' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      void queryClient.setQueryData(['admin', 'event', saved.id], saved);
      if (!isEditing) {
        void navigate(`/admin/kegiatan/${saved.id}/edit`, { replace: true });
      }
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal menyimpan kegiatan.',
      });
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: async (action: 'publish' | 'close' | 'reopen' | 'archive') => {
      if (!id) throw new ApiClientError('Simpan draft terlebih dahulu.', 400);
      if (action === 'publish') return publishAdminEvent(id);
      if (action === 'close') return closeAdminEvent(id);
      if (action === 'reopen') return reopenAdminEvent(id);
      return archiveAdminEvent(id);
    },
    onSuccess: (updated) => {
      setFeedback({
        type: 'success',
        text: `Status kegiatan diperbarui menjadi ${updated.lifecycleStatus}.`,
      });
      void queryClient.setQueryData(['admin', 'event', updated.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiClientError ? err.message : 'Gagal mengubah status kegiatan.',
      });
    },
  });

  function handleFlyerChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    uploadMutation.mutate(file);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    saveMutation.mutate();
  }

  if (isEditing && eventQuery.isPending) {
    return <p className="text-sm text-[var(--color-text-secondary)]">Memuat detail kegiatan...</p>;
  }

  const currentEvent = eventQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/admin/kegiatan"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary-forest)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Kembali ke Daftar Kegiatan</span>
          </Link>
          <h1 className="mt-1 text-xl font-bold text-[var(--color-primary-forest)]">
            {isEditing ? `Edit Kegiatan: ${currentEvent?.title ?? ''}` : 'Buat Kegiatan Baru'}
          </h1>
        </div>

        {isDirty && (
          <span className="inline-flex rounded-full bg-[var(--color-warning-bg)] px-3 py-1 text-xs font-medium text-[var(--color-warning)]">
            Ada perubahan belum disimpan
          </span>
        )}
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

      {/* Segmented Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[42px] shrink-0 rounded-[var(--radius-md)] px-3.5 text-xs font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--color-primary-forest)] text-[var(--color-surface)]'
                : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        onChange={() => setIsDirty(true)}
        className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6"
      >
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="ev-title" className="block text-sm font-medium">
                Judul Kegiatan *
              </label>
              <input
                id="ev-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="mis. Pelatihan Kader Posyandu Integrasi Layanan Primer"
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
              />
            </div>

            <div>
              <label htmlFor="ev-category" className="block text-sm font-medium">
                Kategori Kegiatan *
              </label>
              <select
                id="ev-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base"
              >
                {(categoriesQuery.data ?? []).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ev-code" className="block text-sm font-medium">
                Kode Kegiatan (Opsional, otomatis jika kosong)
              </label>
              <input
                id="ev-code"
                type="text"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                placeholder="mis. KADER-2026-01"
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 font-mono text-base"
              />
            </div>

            <div>
              <label htmlFor="ev-organizer" className="block text-sm font-medium">
                Penyelenggara
              </label>
              <input
                id="ev-organizer"
                type="text"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
              />
            </div>

            <div>
              <label htmlFor="ev-location" className="block text-sm font-medium">
                Lokasi Kegiatan
              </label>
              <input
                id="ev-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="mis. Aula Puskesmas Sumbermanjing Kulon"
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="ev-desc" className="block text-sm font-medium">
                Deskripsi Kegiatan
              </label>
              <textarea
                id="ev-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 text-base"
              />
            </div>

            <div className="sm:col-span-2">
              <p className="text-sm font-medium">
                Flyer Kegiatan (Rasio 16:9, JPEG/PNG/WebP maks. 5 MiB)
              </p>
              <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="aspect-video w-full max-w-xs overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-canvas)]">
                  {flyerUrl ? (
                    <img
                      src={flyerUrl}
                      alt="Preview flyer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-secondary)]">
                      Belum ada flyer
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold hover:bg-[var(--color-canvas)]">
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    <span>{uploadMutation.isPending ? 'Mengunggah...' : 'Pilih Flyer'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFlyerChange}
                      className="sr-only"
                    />
                  </label>
                  {flyerKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setFlyerKey(null);
                        setFlyerUrl(null);
                        setIsDirty(true);
                      }}
                      className="block text-xs font-medium text-[var(--color-danger)] hover:underline"
                    >
                      Hapus flyer dari kegiatan
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ev-start" className="block text-sm font-medium">
                Tanggal &amp; Jam Mulai Kegiatan (WIB) *
              </label>
              <input
                id="ev-start"
                type="datetime-local"
                required
                value={eventStartLocal}
                onChange={(e) => setEventStartLocal(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
              />
            </div>

            <div>
              <label htmlFor="ev-end" className="block text-sm font-medium">
                Tanggal &amp; Jam Selesai Kegiatan (WIB) *
              </label>
              <input
                id="ev-end"
                type="datetime-local"
                required
                value={eventEndLocal}
                onChange={(e) => setEventEndLocal(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
              />
            </div>

            <div>
              <label htmlFor="reg-start" className="block text-sm font-medium">
                Mulai Periode Pengisian (WIB)
              </label>
              <input
                id="reg-start"
                type="datetime-local"
                value={regStartLocal}
                onChange={(e) => setRegStartLocal(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
              />
            </div>

            <div>
              <label htmlFor="reg-end" className="block text-sm font-medium">
                Akhir Periode Pengisian (WIB)
              </label>
              <input
                id="reg-end"
                type="datetime-local"
                value={regEndLocal}
                onChange={(e) => setRegEndLocal(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
              />
            </div>

            <div>
              <label htmlFor="dl-start" className="block text-sm font-medium">
                Mulai Periode Pengunduhan (WIB)
              </label>
              <input
                id="dl-start"
                type="datetime-local"
                value={dlStartLocal}
                onChange={(e) => setDlStartLocal(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
              />
            </div>

            <div>
              <label htmlFor="dl-end" className="block text-sm font-medium">
                Akhir Periode Pengunduhan (WIB)
              </label>
              <input
                id="dl-end"
                type="datetime-local"
                value={dlEndLocal}
                onChange={(e) => setDlEndLocal(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
              />
            </div>

            <div>
              <label htmlFor="ev-quota" className="block text-sm font-medium">
                Kuota Peserta (kosongkan jika tanpa batas)
              </label>
              <input
                id="ev-quota"
                type="number"
                min={1}
                max={10000}
                value={quotaStr}
                onChange={(e) => setQuotaStr(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
              />
            </div>
          </div>
        )}

        {activeTab === 'validation' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="att-mode" className="block text-sm font-medium">
                Metode Validasi Kehadiran
              </label>
              <select
                id="att-mode"
                value={attendanceMode}
                onChange={(e) => setAttendanceMode(e.target.value as AttendanceMode)}
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base"
              >
                <option value="open">Terbuka (Turnstile + duplicate check)</option>
                <option value="pin">PIN Kegiatan (diberikan panitia saat acara)</option>
                <option value="whitelist">Whitelist Peserta (daftar peserta terverifikasi)</option>
              </select>
            </div>

            <div>
              <label htmlFor="iss-mode" className="block text-sm font-medium">
                Metode Penerbitan Sertifikat
              </label>
              <select
                id="iss-mode"
                value={issuanceMode}
                onChange={(e) => setIssuanceMode(e.target.value as IssuanceMode)}
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base"
              >
                <option value="auto">Otomatis setelah pengajuan valid</option>
                <option value="manual_approval">Persetujuan Manual Administrator</option>
              </select>
            </div>

            {attendanceMode === 'pin' && (
              <div className="sm:col-span-2">
                <label htmlFor="ev-pin" className="block text-sm font-medium">
                  PIN Kegiatan{' '}
                  {currentEvent?.hasEventPin
                    ? '(Sudah terpasang — isi untuk mengganti)'
                    : '(Wajib untuk mode PIN)'}
                </label>
                <input
                  id="ev-pin"
                  type="password"
                  value={eventPin}
                  onChange={(e) => setEventPin(e.target.value)}
                  placeholder="Minimal 4 karakter; disimpan dalam bentuk hash"
                  className="mt-1.5 min-h-[44px] w-full max-w-md rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'email' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="unique-key" className="block text-sm font-medium">
                Unique Participant Key Field
              </label>
              <input
                id="unique-key"
                type="text"
                value={uniqueKeyField}
                onChange={(e) => setUniqueKeyField(e.target.value)}
                placeholder="nomor_peserta / nik / email"
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 font-mono text-base"
              />
            </div>

            <div>
              <label htmlFor="search-key" className="block text-sm font-medium">
                Search Key Field Publik
              </label>
              <input
                id="search-key"
                type="text"
                value={searchKeyField}
                onChange={(e) => setSearchKeyField(e.target.value)}
                placeholder="nomor_peserta / nik / email"
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 font-mono text-base"
              />
            </div>

            <div className="flex items-center gap-3 sm:col-span-2">
              <input
                id="auto-email"
                type="checkbox"
                checked={autoSendEmail}
                onChange={(e) => setAutoSendEmail(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="auto-email" className="text-sm">
                Kirim lampiran PDF ke email peserta secara otomatis setelah sertifikat siap
              </label>
            </div>

            <div className="flex items-center gap-3 sm:col-span-2">
              <input
                id="embargo-email"
                type="checkbox"
                checked={embargoEmail}
                onChange={(e) => setEmbargoEmail(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="embargo-email" className="text-sm">
                Tahan pengiriman email sampai periode pengunduhan dibuka (embargo distribusi)
              </label>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="email-subject" className="block text-sm font-medium">
                Subject Email
              </label>
              <input
                id="email-subject"
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-base"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="email-body" className="block text-sm font-medium">
                Isi Email
              </label>
              <textarea
                id="email-body"
                rows={5}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 text-sm"
              />
            </div>
          </div>
        )}

        {activeTab === 'publish' && (
          <div className="space-y-5">
            {!isEditing || !currentEvent ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Simpan kegiatan sebagai draft terlebih dahulu untuk melihat checklist kesiapan
                publikasi dan tombol kontrol lifecycle.
              </p>
            ) : (
              <>
                <div>
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                    Checklist Kesiapan Publikasi
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {(currentEvent.publishChecklist ?? []).map((item) => (
                      <li key={item.key} className="flex items-start gap-2.5 text-sm">
                        {item.passed ? (
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-success)]"
                            aria-hidden="true"
                          />
                        ) : (
                          <XCircle
                            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]"
                            aria-hidden="true"
                          />
                        )}
                        <div>
                          <p className="font-medium text-[var(--color-text-primary)]">
                            {item.label}
                          </p>
                          {item.message && (
                            <p className="text-xs text-[var(--color-danger)]">{item.message}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-3 border-t border-[var(--color-border)] pt-5">
                  {currentEvent.lifecycleStatus === 'draft' && (
                    <button
                      type="button"
                      disabled={lifecycleMutation.isPending || isDirty}
                      onClick={() => lifecycleMutation.mutate('publish')}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-sm font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)] disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      <span>Publikasikan Kegiatan</span>
                    </button>
                  )}

                  {currentEvent.lifecycleStatus === 'published' && (
                    <button
                      type="button"
                      disabled={lifecycleMutation.isPending}
                      onClick={() => lifecycleMutation.mutate('close')}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-warning)] px-4 text-sm font-semibold text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]"
                    >
                      <Lock className="h-4 w-4" aria-hidden="true" />
                      <span>Tutup Manual</span>
                    </button>
                  )}

                  {currentEvent.lifecycleStatus === 'closed' && (
                    <button
                      type="button"
                      disabled={lifecycleMutation.isPending}
                      onClick={() => lifecycleMutation.mutate('reopen')}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-4 text-sm font-semibold text-[var(--color-surface)]"
                    >
                      <Unlock className="h-4 w-4" aria-hidden="true" />
                      <span>Buka Kembali</span>
                    </button>
                  )}

                  {currentEvent.lifecycleStatus !== 'archived' && (
                    <button
                      type="button"
                      disabled={lifecycleMutation.isPending}
                      onClick={() => {
                        if (window.confirm('Arsipkan kegiatan ini?')) {
                          lifecycleMutation.mutate('archive');
                        }
                      }}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-canvas)]"
                    >
                      <Archive className="h-4 w-4" aria-hidden="true" />
                      <span>Arsipkan</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-[var(--color-border)] pt-5">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-green)] px-5 text-sm font-semibold text-[var(--color-surface)] hover:bg-[var(--color-primary-forest)] disabled:opacity-60"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>
              {saveMutation.isPending
                ? 'Menyimpan...'
                : isEditing
                  ? 'Simpan Perubahan'
                  : 'Simpan sebagai Draft'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
