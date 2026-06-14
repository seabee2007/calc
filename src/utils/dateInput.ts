import { toIsoDate } from './scheduleEventUtils';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface DateDocumentFieldLike {
  questionKey?: string;
  key?: string;
  label?: string;
  type?: string;
  inputType?: string;
}

/** True when a document builder question key represents a calendar date value. */
export function isDateQuestionKey(questionKey: string): boolean {
  return /date$/i.test(questionKey) || questionKey === 'requiredBy';
}

/** Detect date fields in the shared document field renderer. */
export function isDateDocumentField(field: DateDocumentFieldLike): boolean {
  const key = (field.questionKey ?? field.key ?? '').toLowerCase();
  const label = (field.label ?? '').toLowerCase();

  return (
    field.type === 'date' ||
    field.inputType === 'date' ||
    isDateQuestionKey(key) ||
    /\bdate\b/.test(label)
  );
}

/** Normalize stored values to YYYY-MM-DD when possible; otherwise return original text. */
export function normalizeDateValue(value: string | null | undefined): string {
  if (!value) return '';
  const raw = value.trim();
  if (!raw) return '';

  if (ISO_DATE_PATTERN.test(raw)) return raw;

  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  return toIsoDate(parsed);
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

/** Format ISO or parseable dates for generated/previewed documents. */
export function formatDateForDocument(value: string | null | undefined): string {
  if (!value) return '';
  const raw = value.trim();
  if (!raw) return '';

  const isoCandidate = ISO_DATE_PATTERN.test(raw) ? `${raw}T00:00:00` : raw;
  const parsed = new Date(isoCandidate);
  if (Number.isNaN(parsed.getTime())) return raw;

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
