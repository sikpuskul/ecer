import type { FormField } from '../schemas/forms';

export interface DynamicValidationResult {
  valid: boolean;
  sanitized: Record<string, string | boolean | string[]>;
  errors: Record<string, string>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NIK_REGEX = /^\d{16}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Guards admin-defined regex patterns against obvious catastrophic backtracking (ReDoS).
 * Rejects nested quantifiers such as (a+)+, (a*)*, ([a-z]+)+, etc. (PRD §11.5).
 */
export function isSafeAdminRegex(pattern: string): boolean {
  if (pattern.length > 120) return false;
  if (/(\+|\*|\{)\)?(\+|\*|\{)/.test(pattern)) return false;
  if (/\([^)]*[+*][^)]*\)[+*{]/.test(pattern)) return false;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shared frontend + backend validator for dynamic participant form submissions (PRD §11.5).
 * Unknown fields are ignored/stripped and never enter `sanitized`.
 */
export function validateDynamicSubmission(
  fields: FormField[],
  rawInput: Record<string, unknown>,
): DynamicValidationResult {
  const sanitized: Record<string, string | boolean | string[]> = {};
  const errors: Record<string, string> = {};

  for (const field of fields) {
    if (!field.isActive) continue;

    const rawValue = rawInput[field.fieldKey];

    if (field.inputType === 'checkbox') {
      if (field.options && field.options.length > 0) {
        const allowed = new Set(field.options.map((o) => o.value));
        const arr = Array.isArray(rawValue) ? rawValue.map(String) : [];
        const invalidOption = arr.find((v) => !allowed.has(v));
        if (invalidOption) {
          errors[field.fieldKey] = `Pilihan "${field.label}" tidak valid.`;
          continue;
        }
        if (field.required && arr.length === 0) {
          errors[field.fieldKey] = `${field.label} wajib dipilih.`;
          continue;
        }
        sanitized[field.fieldKey] = arr;
      } else {
        const checked = rawValue === true || rawValue === 'true';
        if (field.required && !checked) {
          errors[field.fieldKey] = `${field.label} wajib dicentang.`;
          continue;
        }
        sanitized[field.fieldKey] = checked;
      }
      continue;
    }

    const strVal = rawValue === null || rawValue === undefined ? '' : String(rawValue).trim();

    if (!strVal) {
      if (field.required) {
        errors[field.fieldKey] = `${field.label} wajib diisi.`;
      } else {
        sanitized[field.fieldKey] = '';
      }
      continue;
    }

    if (field.inputType === 'nik') {
      if (!NIK_REGEX.test(strVal)) {
        errors[field.fieldKey] = `${field.label} harus terdiri dari tepat 16 digit angka.`;
        continue;
      }
      sanitized[field.fieldKey] = strVal;
      continue;
    }

    if (field.inputType === 'email') {
      if (!EMAIL_REGEX.test(strVal) || strVal.length > 254) {
        errors[field.fieldKey] = 'Format alamat email tidak valid.';
        continue;
      }
      sanitized[field.fieldKey] = strVal.toLowerCase();
      continue;
    }

    if (field.inputType === 'number') {
      const num = Number(strVal);
      if (!Number.isFinite(num)) {
        errors[field.fieldKey] = `${field.label} harus berupa angka yang valid.`;
        continue;
      }
      if (field.minValue !== null && field.minValue !== undefined && num < field.minValue) {
        errors[field.fieldKey] = `${field.label} minimal ${field.minValue}.`;
        continue;
      }
      if (field.maxValue !== null && field.maxValue !== undefined && num > field.maxValue) {
        errors[field.fieldKey] = `${field.label} maksimal ${field.maxValue}.`;
        continue;
      }
      sanitized[field.fieldKey] = strVal;
      continue;
    }

    if (field.inputType === 'date') {
      if (!DATE_REGEX.test(strVal) || Number.isNaN(Date.parse(`${strVal}T00:00:00.000Z`))) {
        errors[field.fieldKey] = `${field.label} harus berupa tanggal valid (YYYY-MM-DD).`;
        continue;
      }
      sanitized[field.fieldKey] = strVal;
      continue;
    }

    if (field.inputType === 'select' || field.inputType === 'radio') {
      const allowed = new Set((field.options ?? []).map((o) => o.value));
      if (!allowed.has(strVal)) {
        errors[field.fieldKey] = `Pilihan ${field.label} tidak tersedia.`;
        continue;
      }
      sanitized[field.fieldKey] = strVal;
      continue;
    }

    if (
      field.minLength !== null &&
      field.minLength !== undefined &&
      strVal.length < field.minLength
    ) {
      errors[field.fieldKey] = `${field.label} minimal ${field.minLength} karakter.`;
      continue;
    }
    if (
      field.maxLength !== null &&
      field.maxLength !== undefined &&
      strVal.length > field.maxLength
    ) {
      errors[field.fieldKey] = `${field.label} maksimal ${field.maxLength} karakter.`;
      continue;
    }

    if (field.pattern) {
      if (!isSafeAdminRegex(field.pattern)) {
        errors[field.fieldKey] = `Aturan pola validasi untuk ${field.label} tidak aman.`;
        continue;
      }
      const regex = new RegExp(field.pattern);
      if (!regex.test(strVal)) {
        errors[field.fieldKey] = `Format ${field.label} tidak sesuai.`;
        continue;
      }
    }

    sanitized[field.fieldKey] = strVal;
  }

  return {
    valid: Object.keys(errors).length === 0,
    sanitized,
    errors,
  };
}
