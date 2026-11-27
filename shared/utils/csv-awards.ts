import { AWARD_BULK_MAX_ROWS, BulkAwardRowSchema, type BulkAwardRow } from '../schemas/awards';

const FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/;

/**
 * Neutralizes spreadsheet formula injection (PRD §18.3, §24) on CSV import/export.
 */
export function sanitizeSpreadsheetCell(raw: string): string {
  const cleaned = raw.replace(/\0/g, '').trim();
  if (!cleaned) return '';
  if (FORMULA_TRIGGER_RE.test(cleaned)) {
    return cleaned.replace(/^[=+\-@\t\r]+/, '').trim();
  }
  return cleaned;
}

function splitCsvLine(line: string, delimiter: ',' | ';'): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export interface CsvAwardParseResult {
  rows: BulkAwardRow[];
  errors: Array<{ line: number; message: string }>;
}

/**
 * Parses CSV text for bulk award import (max 100 rows, anti formula injection).
 * Expected headers (case-insensitive): nama_lengkap (or nama), kategori_penghargaan (or kategori),
 * instansi (optional), email (optional), keterangan (optional).
 */
export function parseAwardsCsv(csvText: string): CsvAwardParseResult {
  const normalized = csvText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const rawLines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length < 2) {
    return {
      rows: [],
      errors: [{ line: 1, message: 'CSV harus memiliki baris header dan minimal 1 baris data.' }],
    };
  }

  const headerLine = rawLines[0]!;
  const delimiter: ',' | ';' =
    headerLine.split(';').length > headerLine.split(',').length ? ';' : ',';
  const headers = splitCsvLine(headerLine, delimiter).map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_'),
  );

  const findCol = (aliases: string[]): number => headers.findIndex((h) => aliases.includes(h));

  const nameIdx = findCol(['nama_lengkap', 'nama', 'recipient_name', 'name']);
  const catIdx = findCol(['kategori_penghargaan', 'kategori', 'award_category', 'peran']);
  const instIdx = findCol(['instansi', 'unit_kerja', 'institution', 'asal_instansi']);
  const emailIdx = findCol(['email', 'alamat_email']);
  const notesIdx = findCol(['keterangan', 'catatan', 'notes']);

  if (nameIdx === -1 || catIdx === -1) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message:
            'Header CSV wajib memuat kolom "nama_lengkap" (atau "nama") dan "kategori_penghargaan" (atau "kategori").',
        },
      ],
    };
  }

  const dataLines = rawLines.slice(1);
  if (dataLines.length > AWARD_BULK_MAX_ROWS) {
    return {
      rows: [],
      errors: [
        {
          line: AWARD_BULK_MAX_ROWS + 2,
          message: `Jumlah baris (${dataLines.length}) melebihi batas maksimal ${AWARD_BULK_MAX_ROWS} baris per batch.`,
        },
      ],
    };
  }

  const rows: BulkAwardRow[] = [];
  const errors: Array<{ line: number; message: string }> = [];

  dataLines.forEach((line, idx) => {
    const lineNum = idx + 2;
    const cols = splitCsvLine(line, delimiter);
    const candidate = {
      recipientName: sanitizeSpreadsheetCell(cols[nameIdx] ?? ''),
      awardCategory: sanitizeSpreadsheetCell(cols[catIdx] ?? ''),
      institution: instIdx >= 0 ? sanitizeSpreadsheetCell(cols[instIdx] ?? '') : '',
      email: emailIdx >= 0 ? sanitizeSpreadsheetCell(cols[emailIdx] ?? '') : '',
      notes: notesIdx >= 0 ? sanitizeSpreadsheetCell(cols[notesIdx] ?? '') : '',
    };

    const parsed = BulkAwardRowSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({
        line: lineNum,
        message: parsed.error.issues[0]?.message ?? 'Format baris tidak valid.',
      });
    } else {
      rows.push(parsed.data);
    }
  });

  return { rows, errors };
}
