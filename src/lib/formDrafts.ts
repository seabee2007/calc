/**
 * Generic localStorage draft helpers for long-lived forms.
 *
 * Keyed by `draftKey` (typically includes userId) so drafts never collide
 * between accounts on the same browser.
 *
 * Draft keys in use:
 *   arden:onboarding:draft:<userId>      — OnboardingFlow
 *   arden:new-project:draft:<userId>     — ProjectForm (create mode)
 */
import { useEffect, useRef } from 'react';

const SCHEMA_VERSION = 1 as const;

interface FormDraftEnvelope<T> {
  schemaVersion: typeof SCHEMA_VERSION;
  draftKey: string;
  values: T;
  updatedAt: string;
}

export function getFormDraftKey(formId: string, userId: string): string {
  return `arden:${formId}:draft:${userId}`;
}

export function getFormDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as Partial<FormDraftEnvelope<T>>;
    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      envelope.schemaVersion !== SCHEMA_VERSION ||
      envelope.draftKey !== key
    ) {
      return null;
    }
    return envelope.values ?? null;
  } catch {
    return null;
  }
}

export function saveFormDraft<T>(key: string, values: T): void {
  try {
    const envelope: FormDraftEnvelope<T> = {
      schemaVersion: SCHEMA_VERSION,
      draftKey: key,
      values,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Storage quota exceeded or private browsing — silently ignore.
  }
}

export function clearFormDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * React hook: debounced draft persistence for forms.
 * Only writes to localStorage when `isDirty=true` and after `debounceMs`.
 *
 * @param key        Full draft key (from getFormDraftKey), or null to disable.
 * @param values     Current form values — pass the watched form object.
 * @param isDirty    Whether the form has unsaved changes.
 * @param debounceMs Milliseconds to debounce saves (default 500).
 */
export function useDebouncedFormDraft<T extends object>(
  key: string | null,
  values: T,
  isDirty: boolean,
  debounceMs = 500,
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable stringify ref so we only re-schedule when values actually change
  const valuesRef = useRef<string>('');

  useEffect(() => {
    if (!key || !isDirty) return;

    const serialized = JSON.stringify(values);
    if (serialized === valuesRef.current) return;
    valuesRef.current = serialized;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveFormDraft(key, values);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  });
}
