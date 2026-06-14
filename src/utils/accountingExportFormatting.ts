/** Shared formatting for accounting/tax export files (PR A). */

export interface ExportCompanyInfo {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  licenseNumber?: string;
}

export const safeNumber = (value: unknown, fallback = 0): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

export const roundMoney = (value: unknown): number => {
  return Math.round(safeNumber(value) * 100) / 100;
};

export const formatMoneyCsv = (value: unknown): string => {
  return roundMoney(value).toFixed(2);
};

export const formatDateOnly = (value: string | Date | null | undefined): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

export const toAsciiExportText = (value: string): string => {
  return value
    .replace(/[—–−]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
};

/** CSV/display: unavailable cost data only — not for explicit zero revenue. */
export const formatMoneyOrNotTracked = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'Not tracked';
  return formatMoneyCsv(value);
};

export function exportCompanyInfoPairs(company?: ExportCompanyInfo): [string, string][] {
  if (!company) return [];
  const pairs: [string, string][] = [];
  if (company.name?.trim()) {
    pairs.push(['Company Name', toAsciiExportText(company.name.trim())]);
  }
  if (company.address?.trim()) {
    pairs.push(['Company Address', toAsciiExportText(company.address.trim())]);
  }
  if (company.phone?.trim()) {
    pairs.push(['Company Phone', toAsciiExportText(company.phone.trim())]);
  }
  if (company.email?.trim()) {
    pairs.push(['Company Email', toAsciiExportText(company.email.trim())]);
  }
  if (company.licenseNumber?.trim()) {
    pairs.push(['License Number', toAsciiExportText(company.licenseNumber.trim())]);
  }
  return pairs;
}
