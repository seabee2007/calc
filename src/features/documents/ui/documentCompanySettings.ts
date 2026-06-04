import type { TaxApplication, TaxSystem } from '../../../types/pricingParams';

const TAX_SYSTEM_VALUES: readonly TaxSystem[] = [
  'none',
  'sales_tax',
  'gross_receipts_tax',
  'vat',
];

const TAX_APPLICATION_VALUES: readonly TaxApplication[] = [
  'materials_only',
  'materials_and_equipment',
  'entire_project',
];

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeTaxSystem(value: unknown): TaxSystem {
  if (typeof value === 'string' && TAX_SYSTEM_VALUES.includes(value as TaxSystem)) {
    return value as TaxSystem;
  }
  return 'none';
}

function normalizeTaxApplication(value: unknown): TaxApplication {
  if (
    typeof value === 'string' &&
    TAX_APPLICATION_VALUES.includes(value as TaxApplication)
  ) {
    return value as TaxApplication;
  }
  return 'materials_only';
}

function normalizeTaxRatePercent(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export interface DocumentCompanySettings {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  licenseNumber: string;
  motto: string;
  logoUrl?: string;
  taxSystem: TaxSystem;
  taxRatePercent: number;
  taxApplication: TaxApplication;
}

export interface DocumentCompanySettingsSource {
  companyName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  licenseNumber?: string | null;
  motto?: string | null;
  logoUrl?: string | null;
  logo?: string | null;
  taxSystem?: TaxSystem | null;
  taxRatePercent?: number | string | null;
  taxApplication?: TaxApplication | null;
}

export function normalizeCompanySettingsForDocument(
  source: DocumentCompanySettingsSource | null | undefined,
): DocumentCompanySettings {
  const normalized: DocumentCompanySettings = {
    companyName: normalizeString(source?.companyName),
    address: normalizeString(source?.address),
    phone: normalizeString(source?.phone),
    email: normalizeString(source?.email),
    licenseNumber: normalizeString(source?.licenseNumber),
    motto: normalizeString(source?.motto),
    taxSystem: normalizeTaxSystem(source?.taxSystem),
    taxRatePercent: normalizeTaxRatePercent(source?.taxRatePercent),
    taxApplication: normalizeTaxApplication(source?.taxApplication),
  };

  const logoUrl =
    normalizeOptionalString(source?.logoUrl) ?? normalizeOptionalString(source?.logo);
  if (logoUrl) {
    normalized.logoUrl = logoUrl;
  }

  return normalized;
}
