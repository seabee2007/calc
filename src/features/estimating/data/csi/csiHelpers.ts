import type { CsiDivisionOption } from '../../domain/csiDivisions';
import { CSI_MASTER_FORMAT } from './csiMasterFormat';
import type {
  CsiDivision,
  CsiMasterFormatData,
  CsiMasterFormatSearchResult,
  CsiSection,
} from './csiTypes';

const DIVISION_BY_CODE = new Map<string, CsiDivision>(
  CSI_MASTER_FORMAT.divisions.map((division) => [division.divisionCode, division]),
);

const SECTION_BY_CODE = new Map<string, CsiSection>(
  CSI_MASTER_FORMAT.sections.map((sectionEntry) => [sectionEntry.sectionCode, sectionEntry]),
);

const SECTIONS_BY_DIVISION = CSI_MASTER_FORMAT.sections.reduce<Map<string, CsiSection[]>>(
  (accumulator, sectionEntry) => {
    const existing = accumulator.get(sectionEntry.divisionCode) ?? [];
    existing.push(sectionEntry);
    accumulator.set(sectionEntry.divisionCode, existing);
    return accumulator;
  },
  new Map(),
);

const SECTION_CODE_PATTERN = /^\d{2} \d{2} \d{2}(\.\d{2})?$/;

function padDivisionCode(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return value.trim();
  return digits.padStart(2, '0').slice(-2);
}

export function normalizeCsiSectionCode(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return '';

  if (SECTION_CODE_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const decimalMatch = trimmed.match(/^(\d{6})\.(\d{2})$/);
  if (decimalMatch) {
    const digits = decimalMatch[1];
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)}.${decimalMatch[2]}`;
  }

  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length === 6) {
    return `${digitsOnly.slice(0, 2)} ${digitsOnly.slice(2, 4)} ${digitsOnly.slice(4, 6)}`;
  }

  if (digitsOnly.length === 8) {
    return `${digitsOnly.slice(0, 2)} ${digitsOnly.slice(2, 4)} ${digitsOnly.slice(4, 6)}.${digitsOnly.slice(6, 8)}`;
  }

  return trimmed.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

export function getCsiDivision(divisionCode: string): CsiDivision | undefined {
  return DIVISION_BY_CODE.get(padDivisionCode(divisionCode));
}

export function getCsiDivisionTitle(divisionCode: string): string {
  return getCsiDivision(divisionCode)?.title ?? '';
}

export function getCsiSection(sectionCode: string): CsiSection | undefined {
  const normalized = normalizeCsiSectionCode(sectionCode);
  return SECTION_BY_CODE.get(normalized);
}

export function getCsiSectionsByDivision(divisionCode: string): CsiSection[] {
  return [...(SECTIONS_BY_DIVISION.get(padDivisionCode(divisionCode)) ?? [])];
}

export function searchCsiSections(query: string): CsiSection[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return CSI_MASTER_FORMAT.sections.filter((sectionEntry) => {
    const haystack = [
      sectionEntry.sectionCode,
      sectionEntry.title,
      sectionEntry.explanation ?? '',
      ...(sectionEntry.alternateTerms ?? []),
    ]
      .join(' ')
      .toLowerCase();

    const normalizedCode = normalizeCsiSectionCode(normalizedQuery);
    if (normalizedCode && sectionEntry.sectionCode === normalizedCode) {
      return true;
    }

    return haystack.includes(normalizedQuery);
  });
}

export function isReservedCsiDivision(divisionCode: string): boolean {
  return getCsiDivision(divisionCode)?.reserved ?? false;
}

export function formatCsiDivisionLabel(divisionCode: string): string {
  const division = getCsiDivision(divisionCode);
  if (!division) return padDivisionCode(divisionCode);
  return `${division.divisionCode} - ${division.title}`;
}

export function getCsiDivisionOptions(includeReserved = false): CsiDivisionOption[] {
  return CSI_MASTER_FORMAT.divisions
    .filter((division) => includeReserved || !division.reserved)
    .map((division) => ({
      code: division.divisionCode,
      name: division.title,
      label: formatCsiDivisionLabel(division.divisionCode),
    }));
}

export function searchCsiMasterFormat(query: string): CsiMasterFormatSearchResult {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return { divisions: [], sections: [] };
  }

  const divisions = CSI_MASTER_FORMAT.divisions.filter((division) => {
    const haystack = [
      division.divisionCode,
      division.title,
      division.group,
      division.subgroup ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return {
    divisions,
    sections: searchCsiSections(query),
  };
}

export function getCsiMasterFormatData(): CsiMasterFormatData {
  return CSI_MASTER_FORMAT;
}

export function isKnownCsiMasterFormatDivision(divisionCode: string): boolean {
  return getCsiDivision(divisionCode) != null;
}

export function matchCsiSectionForDivision(
  divisionCode: string,
  sectionCode: string,
): CsiSection | undefined {
  const normalizedDivision = padDivisionCode(divisionCode);
  const normalizedSection = normalizeCsiSectionCode(sectionCode);
  if (!normalizedSection) return undefined;

  const sectionEntry = getCsiSection(normalizedSection);
  if (!sectionEntry) return undefined;
  if (sectionEntry.divisionCode !== normalizedDivision) return undefined;
  return sectionEntry;
}

export { SECTION_CODE_PATTERN };
