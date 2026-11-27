/**
 * Masks recipient name for public QR verification by default (PRD §17.3).
 * Example: "Siti Aminah" -> "Si** Am****"
 */
export function maskRecipientName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return '***';

  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 2) return `${word[0] ?? '*'}*`;
      if (word.endsWith('.') && word.length <= 4) return word; // preserve short title like "dr."
      const visible = word.slice(0, 2);
      const hiddenLen = Math.min(word.length - 2, 6);
      return `${visible}${'*'.repeat(hiddenLen)}`;
    })
    .join(' ');
}
