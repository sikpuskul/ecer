import { describe, expect, it } from 'vitest';
import { computeEventEligibility } from '@shared/utils/event-status';
import { evaluatePublishChecklist } from '@worker/modules/events/service';
import { detectFlyerImageFormat, isValidFlyerKey } from '@worker/modules/storage/routes';
import type { AdminEventItem } from '@shared/schemas/events';

describe('Phase 3 — Event Status & Eligibility Computation', () => {
  const baseEvent = {
    lifecycleStatus: 'published' as const,
    registrationStartAt: '2026-11-10T01:00:00.000Z',
    registrationEndAt: '2026-11-10T10:00:00.000Z',
    downloadStartAt: '2026-11-10T05:00:00.000Z',
    downloadEndAt: '2026-11-20T10:00:00.000Z',
    quota: 100,
    participantCount: 25,
  };

  it('enforces start_at <= now < end_at boundaries accurately', () => {
    // Before registration starts -> upcoming
    expect(computeEventEligibility(baseEvent, Date.parse('2026-11-10T00:59:59.000Z'))).toEqual({
      computedState: 'upcoming',
      canRegister: false,
      canDownload: false,
    });

    // Exactly at registration start -> active, canRegister only
    expect(computeEventEligibility(baseEvent, Date.parse('2026-11-10T01:00:00.000Z'))).toEqual({
      computedState: 'active',
      canRegister: true,
      canDownload: false,
    });

    // Both registration and download open
    expect(computeEventEligibility(baseEvent, Date.parse('2026-11-10T06:00:00.000Z'))).toEqual({
      computedState: 'active',
      canRegister: true,
      canDownload: true,
    });

    // Exactly at registrationEndAt -> registration_closed (half-open interval), download still open
    expect(computeEventEligibility(baseEvent, Date.parse('2026-11-10T10:00:00.000Z'))).toEqual({
      computedState: 'registration_closed',
      canRegister: false,
      canDownload: true,
    });

    // Exactly at downloadEndAt -> closed
    expect(computeEventEligibility(baseEvent, Date.parse('2026-11-20T10:00:00.000Z'))).toEqual({
      computedState: 'closed',
      canRegister: false,
      canDownload: false,
    });
  });

  it('marks quota_full while keeping download open when download window is active', () => {
    expect(
      computeEventEligibility(
        { ...baseEvent, participantCount: 100 },
        Date.parse('2026-11-10T06:00:00.000Z'),
      ),
    ).toEqual({ computedState: 'quota_full', canRegister: false, canDownload: true });
  });

  it('lets manual close and archive override all open time windows', () => {
    expect(
      computeEventEligibility(
        { ...baseEvent, lifecycleStatus: 'closed' },
        Date.parse('2026-11-10T06:00:00.000Z'),
      ),
    ).toEqual({ computedState: 'closed', canRegister: false, canDownload: false });

    expect(
      computeEventEligibility(
        { ...baseEvent, lifecycleStatus: 'archived' },
        Date.parse('2026-11-10T06:00:00.000Z'),
      ),
    ).toEqual({ computedState: 'archived', canRegister: false, canDownload: false });
  });
});

describe('Phase 3 — Publish Checklist & Flyer Validation', () => {
  it('flags missing PIN when attendanceMode is pin', () => {
    const sampleEvent: AdminEventItem = {
      id: 'ev-1',
      categoryId: 'cat-pelatihan',
      categoryName: 'Pelatihan',
      slug: 'pelatihan-kader',
      eventCode: 'KDR-01',
      title: 'Pelatihan Kader',
      description: '',
      organizer: 'Puskesmas Sumbermanjing Kulon',
      location: 'Aula',
      flyerKey: null,
      flyerUrl: null,
      eventStartAt: '2026-11-10T01:00:00.000Z',
      eventEndAt: '2026-11-10T08:00:00.000Z',
      publishAt: null,
      registrationStartAt: '2026-11-10T01:00:00.000Z',
      registrationEndAt: '2026-11-10T10:00:00.000Z',
      downloadStartAt: '2026-11-10T05:00:00.000Z',
      downloadEndAt: '2026-11-20T10:00:00.000Z',
      emailReleaseAt: null,
      quota: 100,
      participantCount: 0,
      attendanceMode: 'pin',
      issuanceMode: 'auto',
      lifecycleStatus: 'draft',
      uniqueKeyField: 'nomor_peserta',
      searchKeyField: 'nomor_peserta',
      hasEventPin: false,
      emailConfig: {
        autoSend: true,
        embargoUntilDownloadStart: false,
        subject: 'Sertifikat',
        body: 'Terlampir',
      },
      retentionConfig: { participantMonths: 24, pdfMonths: 24, supersededDays: 90 },
      eligibility: { computedState: 'draft', canRegister: false, canDownload: false },
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    };

    const checklist = evaluatePublishChecklist(sampleEvent);
    const pinCheck = checklist.find((c) => c.key === 'attendance_validation');
    expect(pinCheck?.passed).toBe(false);
  });

  it('detects JPEG, PNG, and WebP magic bytes and rejects SVG/arbitrary text', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    expect(detectFlyerImageFormat(png)?.ext).toBe('png');
    expect(detectFlyerImageFormat(jpg)?.ext).toBe('jpg');
    expect(detectFlyerImageFormat(webp)?.ext).toBe('webp');
    expect(detectFlyerImageFormat(svg)).toBeNull();

    expect(isValidFlyerKey('flyers/ev-123/550e8400-e29b-41d4-a716-446655440000.webp')).toBe(true);
    expect(isValidFlyerKey('flyers/../secret.png')).toBe(false);
    expect(isValidFlyerKey('flyers/ev-123/icon.svg')).toBe(false);
  });
});
