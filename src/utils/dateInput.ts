import { toIsoDate } from './scheduleEventUtils';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True when a document builder question key represents a calendar date value. */
export function isDateQuestionKey(questionKey: string): boolean {
  return /date$/i.test(questionKey) || questionKey === 'requiredBy';
}

/** Normalize stored/display values to YYYY-MM-DD for `<input type="date">`. */
export function toDateInputValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  if (ISO_DATE_PATTERN.test(raw)) return raw;

  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return toIsoDate(parsed);
}

/** Coerce a date picker change to YYYY-MM-DD or empty string. */
export function normalizeDateInputValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (ISO_DATE_PATTERN.test(trimmed)) return trimmed;
  return toDateInputValue(trimmed);
}
