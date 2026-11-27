import type { EventComputedEligibility, EventLifecycleStatus } from '../schemas/events';

export interface EventEligibilityInput {
  lifecycleStatus: EventLifecycleStatus;
  registrationStartAt: string | null;
  registrationEndAt: string | null;
  downloadStartAt: string | null;
  downloadEndAt: string | null;
  quota: number | null;
  participantCount: number;
}

function isWithinHalfOpenInterval(
  nowMs: number,
  startIso: string | null,
  endIso: string | null,
): boolean {
  if (!startIso || !endIso) return false;
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;
  // PRD §8.4: start_at <= now < end_at
  return startMs <= nowMs && nowMs < endMs;
}

/**
 * Pure server/shared computation of real-time event state and eligibility.
 * Manual close or archive overrides all public periods (PRD §8.4).
 */
export function computeEventEligibility(
  input: EventEligibilityInput,
  nowMs = Date.now(),
): EventComputedEligibility {
  if (input.lifecycleStatus === 'draft') {
    return { computedState: 'draft', canRegister: false, canDownload: false };
  }
  if (input.lifecycleStatus === 'closed') {
    return { computedState: 'closed', canRegister: false, canDownload: false };
  }
  if (input.lifecycleStatus === 'archived') {
    return { computedState: 'archived', canRegister: false, canDownload: false };
  }

  const regOpen = isWithinHalfOpenInterval(
    nowMs,
    input.registrationStartAt,
    input.registrationEndAt,
  );
  const downloadOpen = isWithinHalfOpenInterval(nowMs, input.downloadStartAt, input.downloadEndAt);

  const isQuotaFull = input.quota !== null && input.participantCount >= input.quota;
  const canRegister = regOpen && !isQuotaFull;
  const canDownload = downloadOpen;

  if (regOpen && isQuotaFull) {
    return { computedState: 'quota_full', canRegister: false, canDownload };
  }

  if (canRegister || canDownload) {
    if (!regOpen && canDownload) {
      const regEndMs = input.registrationEndAt ? Date.parse(input.registrationEndAt) : NaN;
      if (Number.isFinite(regEndMs) && nowMs >= regEndMs) {
        return { computedState: 'registration_closed', canRegister: false, canDownload: true };
      }
    }
    return { computedState: 'active', canRegister, canDownload };
  }

  // Neither registration nor download is currently open: determine if upcoming or ended
  const regStartMs = input.registrationStartAt ? Date.parse(input.registrationStartAt) : NaN;
  const dlStartMs = input.downloadStartAt ? Date.parse(input.downloadStartAt) : NaN;
  const earliestStart = Math.min(
    Number.isFinite(regStartMs) ? regStartMs : Infinity,
    Number.isFinite(dlStartMs) ? dlStartMs : Infinity,
  );

  if (earliestStart !== Infinity && nowMs < earliestStart) {
    return { computedState: 'upcoming', canRegister: false, canDownload: false };
  }

  return { computedState: 'closed', canRegister: false, canDownload: false };
}
