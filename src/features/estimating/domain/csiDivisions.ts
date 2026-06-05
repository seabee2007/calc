export interface CsiDivisionOption {
  code: string;
  name: string;
  label: string;
}

/** CSI MasterFormat division catalog (virtual grouping; not persisted as parent rows). */
export const CSI_DIVISIONS: readonly CsiDivisionOption[] = [
  { code: '00', name: 'Procurement and Contracting Requirements', label: '00 - Procurement and Contracting Requirements' },
  { code: '01', name: 'General Requirements', label: '01 - General Requirements' },
  { code: '02', name: 'Existing Conditions', label: '02 - Existing Conditions' },
  { code: '03', name: 'Concrete', label: '03 - Concrete' },
  { code: '04', name: 'Masonry', label: '04 - Masonry' },
  { code: '05', name: 'Metals', label: '05 - Metals' },
  { code: '06', name: 'Wood, Plastics, and Composites', label: '06 - Wood, Plastics, and Composites' },
  { code: '07', name: 'Thermal and Moisture Protection', label: '07 - Thermal and Moisture Protection' },
  { code: '08', name: 'Openings', label: '08 - Openings' },
  { code: '09', name: 'Finishes', label: '09 - Finishes' },
  { code: '10', name: 'Specialties', label: '10 - Specialties' },
  { code: '11', name: 'Equipment', label: '11 - Equipment' },
  { code: '12', name: 'Furnishings', label: '12 - Furnishings' },
  { code: '13', name: 'Special Construction', label: '13 - Special Construction' },
  { code: '14', name: 'Conveying Equipment', label: '14 - Conveying Equipment' },
  { code: '21', name: 'Fire Suppression', label: '21 - Fire Suppression' },
  { code: '22', name: 'Plumbing', label: '22 - Plumbing' },
  { code: '23', name: 'HVAC', label: '23 - HVAC' },
  { code: '25', name: 'Integrated Automation', label: '25 - Integrated Automation' },
  { code: '26', name: 'Electrical', label: '26 - Electrical' },
  { code: '27', name: 'Communications', label: '27 - Communications' },
  { code: '28', name: 'Electronic Safety and Security', label: '28 - Electronic Safety and Security' },
  { code: '31', name: 'Earthwork', label: '31 - Earthwork' },
  { code: '32', name: 'Exterior Improvements', label: '32 - Exterior Improvements' },
  { code: '33', name: 'Utilities', label: '33 - Utilities' },
  { code: '34', name: 'Transportation', label: '34 - Transportation' },
  { code: '35', name: 'Waterway and Marine Construction', label: '35 - Waterway and Marine Construction' },
  { code: '40', name: 'Process Interconnections', label: '40 - Process Interconnections' },
  { code: '41', name: 'Material Processing and Handling Equipment', label: '41 - Material Processing and Handling Equipment' },
  { code: '42', name: 'Process Heating, Cooling, and Drying Equipment', label: '42 - Process Heating, Cooling, and Drying Equipment' },
  { code: '43', name: 'Process Gas and Liquid Handling, Purification, and Storage Equipment', label: '43 - Process Gas and Liquid Handling, Purification, and Storage Equipment' },
  { code: '44', name: 'Pollution and Waste Control Equipment', label: '44 - Pollution and Waste Control Equipment' },
  { code: '45', name: 'Industry-Specific Manufacturing Equipment', label: '45 - Industry-Specific Manufacturing Equipment' },
  { code: '46', name: 'Water and Wastewater Equipment', label: '46 - Water and Wastewater Equipment' },
  { code: '48', name: 'Electrical Power Generation', label: '48 - Electrical Power Generation' },
] as const;

const DIVISION_BY_CODE = new Map<string, CsiDivisionOption>(
  CSI_DIVISIONS.map((division) => [division.code, division]),
);

const LABEL_PREFIX_PATTERN = /^(\d{1,2})\s*-\s*(.+)$/;

function padDivisionCode(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return value.trim();
  return digits.padStart(2, '0').slice(-2);
}

/** Normalize free-text division input to a two-digit code when possible. */
export function normalizeCsiDivisionCode(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) return '';

  const labelMatch = trimmed.match(LABEL_PREFIX_PATTERN);
  if (labelMatch) {
    return padDivisionCode(labelMatch[1]);
  }

  if (/^\d{1,2}$/.test(trimmed)) {
    return padDivisionCode(trimmed);
  }

  const catalogMatch = CSI_DIVISIONS.find(
    (division) => division.name.localeCompare(trimmed, undefined, { sensitivity: 'base' }) === 0,
  );
  if (catalogMatch) return catalogMatch.code;

  return trimmed;
}

export function getCsiDivisionByCode(code?: string | null): CsiDivisionOption | undefined {
  const normalized = normalizeCsiDivisionCode(code);
  if (!normalized || !/^\d{2}$/.test(normalized)) return undefined;
  return DIVISION_BY_CODE.get(normalized);
}

export function isKnownCsiDivision(code?: string | null): boolean {
  return getCsiDivisionByCode(code) != null;
}

/** Display label for a division code; unknown codes return the raw value. */
export function getCsiDivisionLabel(code?: string | null): string {
  const trimmed = code?.trim();
  if (!trimmed) return '';

  const division = getCsiDivisionByCode(trimmed);
  if (division) return division.label;

  const normalized = normalizeCsiDivisionCode(trimmed);
  const normalizedDivision = getCsiDivisionByCode(normalized);
  if (normalizedDivision) return normalizedDivision.label;

  return trimmed;
}

export function getCsiDivisionOptions(): CsiDivisionOption[] {
  return [...CSI_DIVISIONS].sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true }),
  );
}

/** Short display description for division pickers (catalog name). */
export function getCsiDivisionDescription(code?: string | null): string {
  const division = getCsiDivisionByCode(code);
  return division?.name ?? '';
}
