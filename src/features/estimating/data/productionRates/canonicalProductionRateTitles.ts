import type { NormalizedProductionRateRecord } from './productionRateTypes';
import { collapseWhitespace, getRecordDescription } from './canonicalProductionRateNormalization';

const LEADING_VERBS_DISPLAY =
  /^(install|installation of|place|construct|apply|erect|fabricate)\s+/i;

function titleCaseWord(word: string): string {
  if (!word) return word;
  if (/^\d/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function toTitleCase(value: string): string {
  return collapseWhitespace(
    value
      .split(/\s+/)
      .map((word) => titleCaseWord(word))
      .join(' '),
  );
}

export function stripLeadingVerbsForDisplay(description: string): string {
  return collapseWhitespace(description.replace(LEADING_VERBS_DISPLAY, ''));
}

export function pickBestDescription(records: NormalizedProductionRateRecord[]): string {
  const candidates = records
    .map((record) => getRecordDescription(record))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  return candidates[0] ?? records[0]?.activityName ?? 'Production rate';
}

export function buildCanonicalTitle(records: NormalizedProductionRateRecord[]): string {
  const best = pickBestDescription(records);
  return toTitleCase(stripLeadingVerbsForDisplay(best));
}

export function buildCanonicalDescription(records: NormalizedProductionRateRecord[]): string {
  const unique = [...new Set(records.map((record) => getRecordDescription(record)).filter(Boolean))];
  if (unique.length <= 1) return unique[0] ?? '';
  return unique.slice(0, 3).join('; ');
}

export function buildVariantLabel(record: NormalizedProductionRateRecord): string {
  const description = getRecordDescription(record);
  const parts = description.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const tail = parts[parts.length - 1];
    if (/\d/.test(tail)) return toTitleCase(tail);
  }
  const figureSuffix = record.figure ? ` (${record.figure})` : '';
  return `${toTitleCase(stripLeadingVerbsForDisplay(description))}${figureSuffix}`;
}
