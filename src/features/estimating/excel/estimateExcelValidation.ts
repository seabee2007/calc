import { getCsiDivisionByCode, normalizeCsiDivisionCode } from '../domain/csiDivisions';
import { getMasterActivityByCode } from '../data/masterActivityIndex';
import { parseActivityCode } from '../application/estimateActivityCoding';
import { getProductionRateLibraryEntryById } from '../data/productionRates/productionRateLibrary';
import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';
import type {
  EstimateExcelLineRow,
  EstimateExcelRawRow,
  ImportRowStatus,
  ParsedActivityGroup,
} from './estimateExcelTypes';
import {
  ESTIMATE_EXCEL_HEADER_ALIASES,
  ESTIMATE_EXCEL_LINE_COLUMNS,
  normalizeHeaderKey,
} from './estimateExcelSchemas';

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseBoolean(value: unknown, defaultValue = true): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return defaultValue;
  if (['true', 'yes', 'y', '1'].includes(text)) return true;
  if (['false', 'no', 'n', '0'].includes(text)) return false;
  return defaultValue;
}

function parseString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

export function mapRawRowToLineRow(raw: EstimateExcelRawRow): EstimateExcelLineRow {
  const get = (key: string) => raw.values[key] ?? null;
  return {
    rowNumber: raw.rowNumber,
    divisionCode: parseString(get('division_code')) ?? '',
    divisionName: parseString(get('division_name')) ?? '',
    activityCode: parseString(get('activity_code')),
    activityName: parseString(get('activity_name')) ?? '',
    lineItemDescription: parseString(get('line_item_description')) ?? '',
    quantity: parseNumber(get('quantity')),
    unit: parseString(get('unit')),
    productionRateId: parseString(get('production_rate_id')),
    manHoursPerUnit: parseNumber(get('man_hours_per_unit')),
    crewSize: parseNumber(get('crew_size')),
    laborRole: parseString(get('labor_role')),
    materialUnitCost: parseNumber(get('material_unit_cost')),
    equipmentUnitCost: parseNumber(get('equipment_unit_cost')),
    subcontractorUnitCost: parseNumber(get('subcontractor_unit_cost')),
    scheduleEnabled: parseBoolean(get('schedule_enabled'), true),
    notes: parseString(get('notes')),
    status: 'valid',
    messages: [],
  };
}

export function isBlankLineRow(row: EstimateExcelLineRow): boolean {
  return (
    !row.divisionCode &&
    !row.activityName &&
    !row.lineItemDescription &&
    row.quantity == null &&
    !row.unit
  );
}

export function buildDuplicateKey(row: EstimateExcelLineRow): string {
  return [
    normalizeCsiDivisionCode(row.divisionCode),
    (row.activityCode ?? '').trim().toLowerCase(),
    row.lineItemDescription.trim().toLowerCase(),
    row.quantity ?? '',
    (row.unit ?? '').trim().toLowerCase(),
  ].join('|');
}

export function buildActivityGroupKey(row: EstimateExcelLineRow): string {
  const division = normalizeCsiDivisionCode(row.divisionCode);
  const activityKey = row.activityCode?.trim() || row.activityName.trim().toLowerCase();
  return `${division}::${activityKey}`;
}

export function groupLineRowsIntoActivities(rows: EstimateExcelLineRow[]): ParsedActivityGroup[] {
  const groups = new Map<string, ParsedActivityGroup>();

  for (const row of rows) {
    if (isBlankLineRow(row)) continue;
    const groupKey = buildActivityGroupKey(row);
    const existing = groups.get(groupKey);
    if (existing) {
      existing.lineRows.push(row);
      if (row.crewSize != null && row.crewSize > 0) {
        existing.crewSize = row.crewSize;
      }
      if (!row.scheduleEnabled) {
        existing.scheduleEnabled = false;
      }
      continue;
    }

    groups.set(groupKey, {
      groupKey,
      divisionCode: normalizeCsiDivisionCode(row.divisionCode),
      divisionName: row.divisionName.trim(),
      activityCode: row.activityCode?.trim() || null,
      activityName: row.activityName.trim(),
      crewSize: row.crewSize != null && row.crewSize > 0 ? row.crewSize : 4,
      scheduleEnabled: row.scheduleEnabled,
      lineRows: [row],
      importable: false,
    });
  }

  return [...groups.values()];
}

export interface ValidateLineRowsInput {
  rows: EstimateExcelLineRow[];
  existingDuplicateKeys: ReadonlySet<string>;
  productionRateLookup?: (id: string) => ProductionRateLibraryEntry | undefined;
}

function pushStatus(row: EstimateExcelLineRow, status: ImportRowStatus, message: string) {
  if (status === 'blocked') {
    row.status = 'blocked';
  } else if (status === 'duplicate' && row.status !== 'blocked') {
    row.status = 'duplicate';
  } else if (status === 'unpriced' && row.status === 'valid') {
    row.status = 'unpriced';
  } else if (status === 'warning' && row.status === 'valid') {
    row.status = 'warning';
  }
  if (message) row.messages.push(message);
}

export function validateLineRows(input: ValidateLineRowsInput): EstimateExcelLineRow[] {
  const { rows, existingDuplicateKeys, productionRateLookup } = input;

  for (const row of rows) {
    if (isBlankLineRow(row)) continue;

    if (!row.divisionCode.trim()) {
      pushStatus(row, 'blocked', 'Missing division_code.');
      continue;
    }

    const normalizedDivision = normalizeCsiDivisionCode(row.divisionCode);
    const division = getCsiDivisionByCode(normalizedDivision);
    if (!division) {
      pushStatus(row, 'blocked', `Invalid division_code "${row.divisionCode}".`);
      continue;
    }
    if (!row.divisionName.trim()) {
      row.divisionName = division.name;
    }

    if (!row.activityName.trim()) {
      pushStatus(row, 'blocked', 'Missing activity_name.');
      continue;
    }

    if (!row.lineItemDescription.trim()) {
      pushStatus(row, 'blocked', 'Missing line_item_description.');
      continue;
    }

    if (row.quantity == null || row.quantity <= 0) {
      pushStatus(row, 'blocked', 'Missing or invalid quantity.');
      continue;
    }

    if (!row.unit?.trim()) {
      pushStatus(row, 'blocked', 'Missing unit.');
      continue;
    }

    if (row.activityCode?.trim()) {
      const parsed = parseActivityCode(row.activityCode.trim());
      if (!parsed) {
        pushStatus(row, 'warning', `Activity code "${row.activityCode}" is not DD-AA-II format.`);
      } else {
        const master = getMasterActivityByCode(row.activityCode.trim());
        if (!master) {
          pushStatus(row, 'warning', `Activity code "${row.activityCode}" is not in the master index.`);
        }
      }
    }

    const duplicateKey = buildDuplicateKey(row);
    if (existingDuplicateKeys.has(duplicateKey)) {
      pushStatus(row, 'duplicate', 'Duplicate of an existing estimate line.');
      continue;
    }

    const productionRateId = row.productionRateId?.trim() ?? '';
    if (productionRateId) {
      const entry = productionRateLookup?.(productionRateId);
      if (!entry) {
        pushStatus(row, 'warning', `production_rate_id "${productionRateId}" was not found.`);
        if (row.manHoursPerUnit != null && row.manHoursPerUnit > 0) {
          pushStatus(row, 'warning', 'Using manual man_hours_per_unit because production rate was not found.');
        } else {
          pushStatus(row, 'unpriced', 'Imported as unpriced shell (missing pricing).');
        }
      } else if (row.manHoursPerUnit == null || row.manHoursPerUnit <= 0) {
        row.manHoursPerUnit = entry.manHoursPerUnit ?? 0;
      }
    } else if (row.manHoursPerUnit != null && row.manHoursPerUnit > 0) {
      // Path B manual line — valid
    } else {
      pushStatus(row, 'unpriced', 'Imported as unpriced shell (missing pricing).');
    }
  }

  return rows;
}

export function finalizeGroupImportability(groups: ParsedActivityGroup[]): ParsedActivityGroup[] {
  return groups.map((group) => {
    const importable = group.lineRows.some(
      (row) => row.status === 'valid' || row.status === 'warning' || row.status === 'unpriced',
    );
    return { ...group, importable };
  });
}

export function countRowsByStatus(rows: EstimateExcelLineRow[]) {
  return rows.reduce(
    (acc, row) => {
      if (isBlankLineRow(row)) return acc;
      acc[row.status] += 1;
      return acc;
    },
    {
      valid: 0,
      warning: 0,
      blocked: 0,
      duplicate: 0,
      unpriced: 0,
    },
  );
}

export function parseEstimateLinesSheetRows(
  sheetRows: unknown[][],
): { rows: EstimateExcelRawRow[]; missingColumns: string[] } {
  if (sheetRows.length === 0) {
    return { rows: [], missingColumns: ESTIMATE_EXCEL_LINE_COLUMNS.filter((c) => c.required).map((c) => c.key) };
  }

  const headerRow = sheetRows[0] ?? [];
  const headerMap = new Map<number, string>();
  for (let index = 0; index < headerRow.length; index += 1) {
    const normalized = normalizeHeaderKey(headerRow[index]);
    const canonical = ESTIMATE_EXCEL_HEADER_ALIASES[normalized] ?? normalized;
    if (canonical) headerMap.set(index, canonical);
  }

  const presentColumns = new Set(headerMap.values());
  const missingColumns = ESTIMATE_EXCEL_LINE_COLUMNS.filter(
    (column) => column.required && !presentColumns.has(column.key),
  ).map((column) => column.key);

  const rows: EstimateExcelRawRow[] = [];
  for (let rowIndex = 1; rowIndex < sheetRows.length; rowIndex += 1) {
    const sheetRow = sheetRows[rowIndex] ?? [];
    const values: Record<string, string | number | boolean | null> = {};
    for (const [columnIndex, key] of headerMap.entries()) {
      values[key] = (sheetRow[columnIndex] as string | number | boolean | null | undefined) ?? null;
    }
    rows.push({ rowNumber: rowIndex + 1, values });
  }

  return { rows, missingColumns };
}

export function collectExistingDuplicateKeys(
  existingActivities: readonly { divisionCode: string; activityCode: string }[],
  existingLineItemsByActivityId: ReadonlyMap<
    string,
    readonly {
      name: string;
      description: string;
      quantity: number;
      unit: string;
    }[]
  >,
): Set<string> {
  const keys = new Set<string>();
  for (const activity of existingActivities) {
    const lineItems = existingLineItemsByActivityId.get(activity.id) ?? [];
    for (const item of lineItems) {
      keys.add(
        buildDuplicateKey({
          rowNumber: 0,
          divisionCode: activity.divisionCode,
          divisionName: '',
          activityCode: activity.activityCode,
          activityName: '',
          lineItemDescription: item.description || item.name,
          quantity: item.quantity,
          unit: item.unit,
          productionRateId: null,
          manHoursPerUnit: null,
          crewSize: null,
          laborRole: null,
          materialUnitCost: null,
          equipmentUnitCost: null,
          subcontractorUnitCost: null,
          scheduleEnabled: true,
          notes: null,
          status: 'valid',
          messages: [],
        }),
      );
    }
  }
  return keys;
}

export function importableRowCount(rows: EstimateExcelLineRow[]): number {
  return rows.filter(
    (row) =>
      !isBlankLineRow(row) &&
      (row.status === 'valid' || row.status === 'warning' || row.status === 'unpriced'),
  ).length;
}

export function hasBlockingPreviewErrors(preview: {
  errors: string[];
  importableRowCount?: number;
}): boolean {
  return preview.errors.length > 0 || (preview.importableRowCount ?? 0) === 0;
}
