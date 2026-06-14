import { formatDateForDocument } from '../../../utils/dateInput';

const PLACEHOLDER_TOKEN = /\[[\w.]+\]/g;
const HANDLEBARS_TOKEN = /\{\{[^}]+\}\}/g;

/** Replace raw template fill-in markers with user-friendly preview text. */
export function softenPreviewPlaceholders(body: string): string {
  return body.replace(PLACEHOLDER_TOKEN, 'Not provided');
}

/**
 * Clean assembled section body for client-facing preview/PDF.
 * Removes unreplaced template syntax and normalizes whitespace.
 */
export function cleanDocumentBody(body: string): string {
  return body
    .replace(HANDLEBARS_TOKEN, '')
    .replace(PLACEHOLDER_TOKEN, 'Not provided')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** True when a display value is empty or only a missing-value marker. */
export function isMissingDisplayValue(value: string | undefined | null): boolean {
  if (!value?.trim()) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === 'not provided' || normalized === '—' || normalized === '-';
}

/** Format a display value, using fallback when missing. */
export function displayValue(value: string | undefined | null, fallback = '—'): string {
  return isMissingDisplayValue(value) ? fallback : value!.trim();
}

/** Format a date answer for document preview/PDF (e.g. June 3, 2026). */
export function displayDateValue(value: string | undefined | null, fallback = '—'): string {
  if (isMissingDisplayValue(value)) return fallback;
  const formatted = formatDateForDocument(value!.trim());
  return isMissingDisplayValue(formatted) ? fallback : formatted;
}
