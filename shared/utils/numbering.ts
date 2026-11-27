import type { ResetStrategy } from '../schemas/numbering';
import type { TemplateDocumentType } from '../schemas/templates';

const ROMAN_MONTHS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
] as const;

export function toRomanMonth(month: number): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month number: ${month}`);
  }
  return ROMAN_MONTHS[month - 1]!;
}

export function buildCounterScopeKey(params: {
  resetStrategy: ResetStrategy;
  month: number;
  year: number;
  eventId: string;
}): string {
  switch (params.resetStrategy) {
    case 'never':
      return 'global';
    case 'yearly':
      return `year:${params.year}`;
    case 'monthly':
      return `month:${params.year}-${String(params.month).padStart(2, '0')}`;
    case 'per_event':
      return `event:${params.eventId}`;
  }
}

export function formatDocumentNumber(params: {
  formatPattern: string;
  sequenceNumber: number;
  sequencePadding: number;
  documentType: TemplateDocumentType;
  eventCode: string;
  organizationCode: string;
  month: number;
  year: number;
}): string {
  const seq = String(params.sequenceNumber).padStart(params.sequencePadding, '0');
  const monthPadded = String(params.month).padStart(2, '0');
  const monthRoman = toRomanMonth(params.month);
  const docTypeCode = params.documentType === 'award' ? 'PIAGAM' : 'SERT';

  return params.formatPattern
    .replaceAll('{SEQ}', seq)
    .replaceAll('{EVENT_CODE}', params.eventCode)
    .replaceAll('{DOC_TYPE}', docTypeCode)
    .replaceAll('{MONTH}', monthPadded)
    .replaceAll('{MONTH_ROMAN}', monthRoman)
    .replaceAll('{YEAR}', String(params.year))
    .replaceAll('{ORG_CODE}', params.organizationCode);
}

/**
 * Sanitizes PDF filename per PRD §13.7:
 * Sertifikat_[NamaPeserta]_[NomorDokumen].pdf or Piagam_[NamaPenerima]_[NomorDokumen].pdf
 * Never includes NIK or unsafe path characters.
 */
export function buildSafeDocumentFilename(params: {
  documentType: TemplateDocumentType;
  recipientName: string;
  documentNumber: string;
}): string {
  const prefix = params.documentType === 'award' ? 'Piagam' : 'Sertifikat';
  const safeName =
    params.recipientName
      .trim()
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'Penerima';
  const safeNum = params.documentNumber
    .trim()
    .replace(/[^a-zA-Z0-9-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);

  return `${prefix}_${safeName}_${safeNum}.pdf`;
}
