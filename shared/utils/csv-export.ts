const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

/**
 * Formats a single CSV cell safely, preventing spreadsheet formula injection (PRD §24)
 * and escaping RFC-4180 quotes/delimiters/newlines.
 */
export function toSafeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let str = String(value).replace(/\0/g, '');
  if (FORMULA_PREFIX_RE.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildSafeCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const headerLine = headers.map((h) => toSafeCsvCell(h)).join(',');
  const dataLines = rows.map((row) => row.map((cell) => toSafeCsvCell(cell)).join(','));
  // UTF-8 BOM for clean Indonesian character rendering in Excel
  return `\uFEFF${[headerLine, ...dataLines].join('\r\n')}\r\n`;
}
