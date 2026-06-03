import type { CompanySettings } from './companySettingsService';

export type CompanySettingsUpdateOptions = {
  /** When false (default), empty strings do not replace existing non-empty text fields. */
  allowEmptyTextOverwrite?: boolean;
};

export const PROTECTED_COMPANY_TEXT_FIELDS = [
  'companyName',
  'address',
  'phone',
  'email',
  'licenseNumber',
  'motto',
] as const satisfies ReadonlyArray<keyof CompanySettings>;

export type ProtectedCompanyTextField = (typeof PROTECTED_COMPANY_TEXT_FIELDS)[number];

export function isNonEmptyCompanyText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Merge a settings patch onto current values without blanking protected text fields
 * unless allowEmptyTextOverwrite is true.
 */
export function mergeCompanySettingsUpdates(
  current: CompanySettings,
  updates: Partial<CompanySettings>,
  options?: CompanySettingsUpdateOptions,
): CompanySettings {
  const allowEmpty = options?.allowEmptyTextOverwrite ?? false;
  const merged: CompanySettings = { ...current };

  for (const [key, value] of Object.entries(updates) as [
    keyof CompanySettings,
    CompanySettings[keyof CompanySettings],
  ][]) {
    if (value === undefined) continue;

    if (
      (PROTECTED_COMPANY_TEXT_FIELDS as readonly string[]).includes(key) &&
      typeof value === 'string' &&
      !allowEmpty &&
      !isNonEmptyCompanyText(value) &&
      isNonEmptyCompanyText(current[key] as string)
    ) {
      continue;
    }

    (merged as Record<string, unknown>)[key] = value;
  }

  return merged;
}

export function patchTouchesProtectedText(patch: Partial<CompanySettings>): boolean {
  return PROTECTED_COMPANY_TEXT_FIELDS.some((key) => key in patch);
}

export function patchIsLogoOrTaxOnly(patch: Partial<CompanySettings>): boolean {
  const keys = Object.keys(patch);
  if (keys.length === 0) return true;
  return keys.every(
    (key) =>
      key === 'taxSystem' ||
      key === 'taxRatePercent' ||
      key === 'taxApplication' ||
      key === 'logo' ||
      key === 'logoUrl' ||
      key === 'logoPath',
  );
}
