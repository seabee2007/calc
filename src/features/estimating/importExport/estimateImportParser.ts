import * as XLSX from 'xlsx';
import {
  assignActivityCodeToDraftLine,
  buildActivityCode,
  buildWorkPackageCode,
  indexActivityCodes,
  normalizeRelationshipType,
  parseActivityCode,
  sortDraftLinesByActivityCode,
  syncActivityCodeFromParsedManualCode,
} from '../application/estimateActivityCoding';
import {
  applyDraftLaborDefaults,
  applyDivisionScopeDefaults,
  createEmptyDraftLine,
  reindexDraftLines,
  type EstimateDraftLine,
} from '../application/estimateDraftLine';
import { computeLinePreviewTotals } from '../ui/estimateFormDefaults';
import type { EstimateRelationshipType } from '../domain/estimateTypes';
import {
  getCsiDivisionByCode,
  normalizeCsiDivisionCode,
} from '../domain/csiDivisions';
import {
  getCsiDivision,
  matchCsiSectionForDivision,
  normalizeCsiSectionCode,
} from '../data/csi';
import { normalizeScopeName } from '../domain/csiScopeTemplates';
import { getMasterActivityByCode } from '../data/masterActivityIndex';
import type { EstimateSelectedDivision, EstimateSettings } from '../domain/estimateTypes';
import {
  ESTIMATE_SETTINGS_SHEET_NAME,
  normalizeEstimateSettings,
  parseEstimateSettingsSheetRows,
} from '../application/estimateSettings';
import {
  ESTIMATE_IMPORT_ALL_COLUMNS,
  ESTIMATE_IMPORT_LINE_ITEMS_SHEET_NAME,
  ESTIMATE_IMPORT_REQUIRED_COLUMNS,
  type EstimateImportColumn,
} from './estimateImportColumns';

export interface ImportedEstimateRow {
  rowNumber: number;
  activity_code?: string;
  division_code: string;
  division_name: string;
  work_package: string;
  work_package_code?: string;
  work_package_name?: string;
  activity_sequence?: number;
  line_sequence?: number;
  activity_title: string;
  description: string;
  quantity: number;
  unit: string;
  labor_hours?: number;
  labor_rate?: number;
  labor_cost?: number;
  material_cost?: number;
  equipment_cost?: number;
  subcontractor_cost?: number;
  overhead_percent?: number;
  profit_percent?: number;
  total_cost?: number;
  duration_days?: number;
  crew_size?: number;
  predecessor_activity_code?: string;
  relationship_type?: EstimateRelationshipType;
  lag_days?: number;
  predecessor_activity?: string;
  notes?: string;
  csi_section?: string;
}

export interface MapRowsToEstimateDataOptions {
  autoRenumberDuplicates?: boolean;
  strictDuplicates?: boolean;
  estimateSettings?: EstimateSettings;
}

export function hasDuplicateImportedActivityCodes(draftLines: EstimateDraftLine[]): string[] {
  return indexActivityCodes(draftLines).duplicates;
}

export interface ImportedEstimateData {
  rows: ImportedEstimateRow[];
  draftLines: EstimateDraftLine[];
  selectedDivisions: EstimateSelectedDivision[];
  estimateSettings?: EstimateSettings;
  warnings: string[];
  errors: string[];
}

export interface EstimateImportPreview {
  divisionCount: number;
  lineItemCount: number;
  estimatedTotal: number;
  divisions: Array<{ code: string; name: string; lineItemCount: number }>;
  warnings: string[];
  errors: string[];
}

export interface ParseEstimateFileResult {
  rows: Record<string, unknown>[];
  estimateSettings?: EstimateSettings;
  warnings: string[];
  errors: string[];
}

const HEADER_ALIASES: Record<string, EstimateImportColumn> = {
  division: 'division_code',
  divisioncode: 'division_code',
  csi_division: 'division_code',
  divisionname: 'division_name',
  activity: 'activity_title',
  activitytitle: 'activity_title',
  title: 'activity_title',
  workpackage: 'work_package',
  scope: 'work_package',
  qty: 'quantity',
  laborhours: 'labor_hours',
  laborrate: 'labor_rate',
  laborcost: 'labor_cost',
  materialcost: 'material_cost',
  equipmentcost: 'equipment_cost',
  subcontractorcost: 'subcontractor_cost',
  overheadpercent: 'overhead_percent',
  overhead: 'overhead_percent',
  profitpercent: 'profit_percent',
  profit: 'profit_percent',
  totalcost: 'total_cost',
  total: 'total_cost',
  durationdays: 'duration_days',
  duration: 'duration_days',
  crewsize: 'crew_size',
  predecessoractivity: 'predecessor_activity',
  predecessor: 'predecessor_activity',
  activitycode: 'activity_code',
  workpackagecode: 'work_package_code',
  workpackagename: 'work_package_name',
  activitysequence: 'activity_sequence',
  linesequence: 'line_sequence',
  predecessoractivitycode: 'predecessor_activity_code',
  relationshiptype: 'relationship_type',
  lagdays: 'lag_days',
  csi_section: 'csi_section',
  csisection: 'csi_section',
};

function normalizeHeader(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function resolveHeaderKey(normalized: string): EstimateImportColumn | null {
  if (!normalized) return null;
  if ((ESTIMATE_IMPORT_ALL_COLUMNS as readonly string[]).includes(normalized)) {
    return normalized as EstimateImportColumn;
  }
  const compact = normalized.replace(/_/g, '');
  const alias = HEADER_ALIASES[compact] ?? HEADER_ALIASES[normalized];
  return alias ?? null;
}

function cellToString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function coerceOptionalNumber(
  value: unknown,
  field: string,
  rowNumber: number,
  warnings: string[],
): number | undefined {
  if (value == null || cellToString(value) === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(parsed)) {
    warnings.push(`Row ${rowNumber}: invalid number for ${field}; treated as blank.`);
    return undefined;
  }
  return parsed;
}

function coerceRequiredNumber(
  value: unknown,
  field: string,
  rowNumber: number,
  errors: string[],
): number | null {
  if (value == null || cellToString(value) === '') {
    errors.push(`Row ${rowNumber}: missing required numeric value for ${field}.`);
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(parsed)) {
    errors.push(`Row ${rowNumber}: invalid number for ${field}.`);
    return null;
  }
  return parsed;
}

function calculateImportedTotalCost(row: {
  labor_cost?: number;
  material_cost?: number;
  equipment_cost?: number;
  subcontractor_cost?: number;
  overhead_percent?: number;
  profit_percent?: number;
}): number {
  const direct =
    (row.labor_cost ?? 0) +
    (row.material_cost ?? 0) +
    (row.equipment_cost ?? 0) +
    (row.subcontractor_cost ?? 0);
  const overhead = direct * ((row.overhead_percent ?? 0) / 100);
  const subtotal = direct + overhead;
  const profit = subtotal * ((row.profit_percent ?? 0) / 100);
  return Math.round((subtotal + profit) * 100) / 100;
}

function resolveLaborHours(row: ImportedEstimateRow): number | undefined {
  if (row.labor_hours != null && row.labor_hours > 0) return row.labor_hours;
  if (
    row.labor_cost != null &&
    row.labor_cost > 0 &&
    row.labor_rate != null &&
    row.labor_rate > 0
  ) {
    return row.labor_cost / row.labor_rate;
  }
  return undefined;
}

function resolveDurationDays(
  row: ImportedEstimateRow,
  laborHours?: number,
): number | undefined {
  if (row.duration_days != null && row.duration_days > 0) return row.duration_days;
  if (
    laborHours != null &&
    laborHours > 0 &&
    row.crew_size != null &&
    row.crew_size > 0
  ) {
    return laborHours / (row.crew_size * 8);
  }
  return undefined;
}

function appendImportedCsiValidationWarnings(
  rowNumber: number,
  divisionCode: string,
  rawSection: string | undefined,
  warnings: string[],
): string | undefined {
  const division = getCsiDivision(divisionCode);
  if (!division) {
    warnings.push(`Row ${rowNumber}: unknown CSI division code "${divisionCode}".`);
  }

  const trimmedSection = rawSection?.trim();
  if (!trimmedSection) return undefined;

  const normalizedSection = normalizeCsiSectionCode(trimmedSection);
  if (!normalizedSection) {
    warnings.push(`Row ${rowNumber}: invalid CSI section "${trimmedSection}".`);
    return trimmedSection;
  }

  const matched = matchCsiSectionForDivision(divisionCode, normalizedSection);
  if (!matched) {
    warnings.push(
      `Row ${rowNumber}: CSI section "${normalizedSection}" not found for division "${divisionCode}" (csiSectionMatched: false).`,
    );
  }

  return normalizedSection;
}

function mapRowToDraftLine(row: ImportedEstimateRow, position: number): EstimateDraftLine {
  const laborHours = resolveLaborHours(row);
  const durationDays = resolveDurationDays(row, laborHours);
  const quantity = row.quantity;
  const productionRate =
    laborHours != null && quantity > 0 ? laborHours / quantity : 0;
  const workPackageName =
    normalizeScopeName(row.work_package_name || row.work_package) || row.work_package;
  const predecessorCode =
    row.predecessor_activity_code?.trim() ||
    (row.predecessor_activity?.trim() && /^\d{2}-\d{2}-\d{2}$/.test(row.predecessor_activity.trim())
      ? row.predecessor_activity.trim()
      : undefined);

  let draft = createEmptyDraftLine(position);
  draft = {
    ...draft,
    unit: row.unit,
    task: {
      ...draft.task,
      activityCode: row.activity_code,
      divisionCode: row.division_code,
      divisionName: row.division_name,
      workPackageCode: row.work_package_code,
      workPackageName,
      activitySequence: row.activity_sequence,
      lineSequence: row.line_sequence,
      predecessorActivityCode: predecessorCode,
      relationshipType: normalizeRelationshipType(row.relationship_type),
      lagDays: row.lag_days ?? 0,
      title: row.activity_title,
      description: row.description || row.activity_title,
      scopeName: workPackageName,
      overheadPercent: row.overhead_percent ?? 0,
      profitPercent: row.profit_percent ?? 0,
      lineItem: {
        ...draft.task.lineItem,
        description: row.description || row.activity_title,
        csiDivision: row.division_code,
        csiSection: row.csi_section,
        quantity: {
          formula: 'quantity_with_waste',
          quantity,
          wastePercent: 0,
        },
        labor: {
          ...draft.task.lineItem.labor,
          productionRateType: 'labor_hours_per_unit',
          productionRate,
          laborRate: row.labor_rate ?? 0,
          crewSize: row.crew_size != null && row.crew_size > 0 ? row.crew_size : 1,
          hoursPerDay: 8,
        },
        material: {
          unitCost:
            row.material_cost != null && quantity > 0 ? row.material_cost / quantity : 0,
        },
        equipment: {
          ...draft.task.lineItem.equipment,
          rate: row.equipment_cost ?? 0,
          rateType: 'lump_sum',
          usageUnits: 1,
        },
        subcontractor: {
          cost: row.subcontractor_cost ?? 0,
        },
      },
      calculatedValues: {
        unit: row.unit,
        importedEstimate: {
          notes: row.notes || undefined,
          predecessorActivityCode: predecessorCode,
          predecessorActivity: row.predecessor_activity || undefined,
          relationshipType: normalizeRelationshipType(row.relationship_type),
          lagDays: row.lag_days ?? 0,
          durationDays,
          laborHours,
          laborCost: row.labor_cost,
          materialCost: row.material_cost,
          equipmentCost: row.equipment_cost,
          subcontractorCost: row.subcontractor_cost,
          totalCost: row.total_cost,
        },
      },
    },
  };

  return enrichImportedDraftFromMaster(
    applyDivisionScopeDefaults(applyDraftLaborDefaults(draft)),
  );
}

/**
 * Links an imported draft to the master dataset when its activity code matches,
 * non-destructively: it attaches the master classification (type, category,
 * logic anchor) and marks the row as master-linked, but preserves the imported
 * title, work package, quantities, and costs (the imported file is the source of
 * truth for those). Rows with no matching master code are flagged as custom so
 * their code/title survive the round-trip untouched.
 */
function enrichImportedDraftFromMaster(draft: EstimateDraftLine): EstimateDraftLine {
  const code = draft.task.activityCode?.trim();
  const master = code ? getMasterActivityByCode(code) : undefined;

  if (!master) {
    const hasIdentity = Boolean(code || draft.task.title.trim());
    return {
      ...draft,
      task: {
        ...draft.task,
        isCustomActivity: hasIdentity ? true : draft.task.isCustomActivity,
        masterActivityCode: undefined,
        displayCode: code || draft.task.displayCode,
      },
    };
  }

  return {
    ...draft,
    task: {
      ...draft.task,
      trade: draft.task.trade?.trim() || master.primaryTrade,
      masterActivityCode: master.activityCode,
      isCustomActivity: false,
      displayCode: code,
      activityType: draft.task.activityType ?? master.activityType,
      sequencingCategory: draft.task.sequencingCategory ?? master.sequencingCategory,
      logicAnchor: draft.task.logicAnchor ?? master.logicAnchor,
      lineItem: {
        ...draft.task.lineItem,
        csiDivision: draft.task.lineItem.csiDivision ?? master.csiDivisionCode,
        csiSection: draft.task.lineItem.csiSection ?? master.csiSectionCode,
      },
    },
  };
}

function buildImportedSelectedDivisions(
  rows: ImportedEstimateRow[],
): EstimateSelectedDivision[] {
  const seen = new Set<string>();
  const divisions: EstimateSelectedDivision[] = [];
  const createdAt = new Date().toISOString();

  for (const row of rows) {
    const code = normalizeCsiDivisionCode(row.division_code);
    if (!code || !/^\d{2}$/.test(code) || seen.has(code)) continue;
    seen.add(code);
    const catalog = getCsiDivisionByCode(code);
    divisions.push({
      code,
      name: row.division_name?.trim() || catalog?.name || code,
      source: 'import',
      reason: 'Imported from estimate file',
      createdAt,
    });
  }

  return divisions;
}

function isBlankImportRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every((value) => cellToString(value) === '');
}

export function normalizeImportedSheetRows(
  rawRows: Record<string, unknown>[],
): Record<string, unknown>[] {
  if (rawRows.length === 0) return [];

  const headerKeys = new Set<string>();
  for (const row of rawRows) {
    Object.keys(row).forEach((key) => headerKeys.add(key));
  }

  const columnMap = new Map<string, EstimateImportColumn>();
  for (const key of headerKeys) {
    const resolved = resolveHeaderKey(normalizeHeader(key));
    if (resolved) columnMap.set(key, resolved);
  }

  return rawRows
    .map((rawRow) => {
      const normalized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rawRow)) {
        const column = columnMap.get(key);
        if (!column) continue;
        normalized[column] = value;
      }
      return normalized;
    })
    .filter((row) => !isBlankImportRow(row));
}

export function validateImportedEstimate(
  rows: Record<string, unknown>[],
): { warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (rows.length === 0) {
    errors.push('No data rows found in the import file.');
    return { warnings, errors };
  }

  const presentColumns = new Set(
    Object.keys(rows[0] ?? {}).map((key) => normalizeHeader(key)),
  );
  for (const required of ESTIMATE_IMPORT_REQUIRED_COLUMNS) {
    if (!presentColumns.has(required)) {
      errors.push(`Missing required column: ${required}.`);
    }
  }

  if (errors.length > 0) return { warnings, errors };

  let validRowCount = 0;
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const activityTitle = cellToString(row.activity_title);
    if (!activityTitle) {
      errors.push(`Row ${rowNumber}: activity_title is required.`);
      return;
    }

    const divisionCode = normalizeCsiDivisionCode(cellToString(row.division_code));
    if (!divisionCode || !/^\d{2}$/.test(divisionCode)) {
      warnings.push(`Row ${rowNumber}: invalid division_code "${cellToString(row.division_code)}"; row skipped.`);
      return;
    }
    if (!getCsiDivision(divisionCode)) {
      warnings.push(`Row ${rowNumber}: unknown CSI division code "${divisionCode}".`);
    }

    const rawCsiSection = cellToString(row.csi_section);
    if (rawCsiSection) {
      appendImportedCsiValidationWarnings(rowNumber, divisionCode, rawCsiSection, warnings);
    }

    const quantity = coerceRequiredNumber(row.quantity, 'quantity', rowNumber, errors);
    if (quantity == null) return;

    const unit = cellToString(row.unit);
    if (!unit) {
      errors.push(`Row ${rowNumber}: unit is required.`);
      return;
    }

    coerceOptionalNumber(row.labor_hours, 'labor_hours', rowNumber, warnings);
    coerceOptionalNumber(row.labor_rate, 'labor_rate', rowNumber, warnings);
    coerceOptionalNumber(row.labor_cost, 'labor_cost', rowNumber, warnings);
    coerceOptionalNumber(row.material_cost, 'material_cost', rowNumber, warnings);
    coerceOptionalNumber(row.equipment_cost, 'equipment_cost', rowNumber, warnings);
    coerceOptionalNumber(row.subcontractor_cost, 'subcontractor_cost', rowNumber, warnings);
    coerceOptionalNumber(row.overhead_percent, 'overhead_percent', rowNumber, warnings);
    coerceOptionalNumber(row.profit_percent, 'profit_percent', rowNumber, warnings);
    coerceOptionalNumber(row.total_cost, 'total_cost', rowNumber, warnings);
    coerceOptionalNumber(row.duration_days, 'duration_days', rowNumber, warnings);
    coerceOptionalNumber(row.crew_size, 'crew_size', rowNumber, warnings);

    validRowCount += 1;
  });

  if (validRowCount === 0) {
    errors.push('No valid rows could be imported from the file.');
  }

  return { warnings, errors };
}

export function finalizeImportedDraftLines(
  draftLines: EstimateDraftLine[],
  options: MapRowsToEstimateDataOptions = {},
): { draftLines: EstimateDraftLine[]; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  let working = [...draftLines];

  for (let index = 0; index < working.length; index += 1) {
    const line = working[index];
    if (line.task.activityCode?.trim()) {
      working[index] = syncActivityCodeFromParsedManualCode(line, working);
    }
  }

  const duplicates = hasDuplicateImportedActivityCodes(working);
  if (duplicates.length > 0) {
    const message = `Duplicate activity codes found: ${duplicates.join(', ')}.`;
    if (options.autoRenumberDuplicates) {
      warnings.push(`${message} Duplicate codes were auto-renumbered.`);
      const seen = new Set<string>();
      working = working.map((line) => {
        const code = line.task.activityCode?.trim();
        if (!code || !seen.has(code)) {
          if (code) seen.add(code);
          return line;
        }
        const regenerated = assignActivityCodeToDraftLine(
          { ...line, task: { ...line.task, activityCode: undefined } },
          working,
        );
        seen.add(regenerated.task.activityCode ?? '');
        return regenerated;
      });
    } else if (options.strictDuplicates) {
      errors.push(`${message} Enable auto-renumber or fix the file before importing.`);
    } else {
      warnings.push(message);
    }
  }

  working = working.map((line, index) => {
    if (line.task.activityCode?.trim() && parseActivityCode(line.task.activityCode)) {
      return line;
    }
    return assignActivityCodeToDraftLine(line, working.slice(0, index).concat(working.slice(index)));
  });

  const codeSet = new Set(
    working.map((line) => line.task.activityCode?.trim()).filter(Boolean) as string[],
  );
  for (const line of working) {
    const predecessor = line.task.predecessorActivityCode?.trim();
    if (predecessor && !codeSet.has(predecessor)) {
      warnings.push(
        `Activity "${line.task.activityCode ?? line.task.title}" references missing predecessor "${predecessor}".`,
      );
    }
  }

  const customCount = working.filter((line) => line.task.isCustomActivity === true).length;
  if (customCount > 0) {
    warnings.push(
      `${customCount} ${
        customCount === 1 ? 'activity was' : 'activities were'
      } imported as custom (no matching master activity). Their codes and titles were preserved.`,
    );
  }

  return {
    draftLines: reindexDraftLines(sortDraftLinesByActivityCode(working)),
    warnings,
    errors,
  };
}

export function mapRowsToEstimateData(
  rows: Record<string, unknown>[],
  options: MapRowsToEstimateDataOptions = {},
): ImportedEstimateData {
  const warnings: string[] = [];
  const errors: string[] = [];
  const importedRows: ImportedEstimateRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const activityTitle = cellToString(row.activity_title);
    if (!activityTitle) return;

    const divisionCode = normalizeCsiDivisionCode(cellToString(row.division_code));
    if (!divisionCode || !/^\d{2}$/.test(divisionCode)) return;

    const quantity = coerceRequiredNumber(row.quantity, 'quantity', rowNumber, errors);
    if (quantity == null) return;

    const unit = cellToString(row.unit);
    if (!unit) return;

    const divisionNameRaw = cellToString(row.division_name);
    const catalog = getCsiDivisionByCode(divisionCode);

    const workPackageName =
      cellToString(row.work_package_name) || cellToString(row.work_package);
    const activitySequence = coerceOptionalNumber(
      row.activity_sequence,
      'activity_sequence',
      rowNumber,
      warnings,
    );
    const lineSequence = coerceOptionalNumber(
      row.line_sequence,
      'line_sequence',
      rowNumber,
      warnings,
    );
    const activityCode = cellToString(row.activity_code);
    const workPackageCode =
      cellToString(row.work_package_code) ||
      (activityCode && parseActivityCode(activityCode)
        ? buildWorkPackageCode(
            parseActivityCode(activityCode)!.divisionCode,
            parseActivityCode(activityCode)!.activitySequence,
          )
        : activitySequence != null
          ? buildWorkPackageCode(divisionCode, activitySequence)
          : '');

    const rawCsiSection = cellToString(row.csi_section) || undefined;
    const normalizedCsiSection = appendImportedCsiValidationWarnings(
      rowNumber,
      divisionCode,
      rawCsiSection,
      warnings,
    );

    const mapped: ImportedEstimateRow = {
      rowNumber,
      activity_code: activityCode || undefined,
      division_code: divisionCode,
      division_name: divisionNameRaw || catalog?.name || divisionCode,
      work_package: workPackageName,
      work_package_code: workPackageCode || undefined,
      work_package_name: workPackageName || undefined,
      activity_sequence: activitySequence,
      line_sequence: lineSequence,
      activity_title: activityTitle,
      description: cellToString(row.description) || activityTitle,
      quantity,
      unit,
      labor_hours: coerceOptionalNumber(row.labor_hours, 'labor_hours', rowNumber, warnings),
      labor_rate: coerceOptionalNumber(row.labor_rate, 'labor_rate', rowNumber, warnings),
      labor_cost: coerceOptionalNumber(row.labor_cost, 'labor_cost', rowNumber, warnings),
      material_cost: coerceOptionalNumber(row.material_cost, 'material_cost', rowNumber, warnings),
      equipment_cost: coerceOptionalNumber(row.equipment_cost, 'equipment_cost', rowNumber, warnings),
      subcontractor_cost: coerceOptionalNumber(
        row.subcontractor_cost,
        'subcontractor_cost',
        rowNumber,
        warnings,
      ),
      overhead_percent: coerceOptionalNumber(
        row.overhead_percent,
        'overhead_percent',
        rowNumber,
        warnings,
      ),
      profit_percent: coerceOptionalNumber(row.profit_percent, 'profit_percent', rowNumber, warnings),
      total_cost: coerceOptionalNumber(row.total_cost, 'total_cost', rowNumber, warnings),
      duration_days: coerceOptionalNumber(row.duration_days, 'duration_days', rowNumber, warnings),
      crew_size: coerceOptionalNumber(row.crew_size, 'crew_size', rowNumber, warnings),
      predecessor_activity_code: cellToString(row.predecessor_activity_code) || undefined,
      relationship_type: normalizeRelationshipType(cellToString(row.relationship_type)),
      lag_days: coerceOptionalNumber(row.lag_days, 'lag_days', rowNumber, warnings) ?? 0,
      predecessor_activity: cellToString(row.predecessor_activity),
      notes: cellToString(row.notes),
      csi_section: normalizedCsiSection ?? rawCsiSection,
    };

    if (
      !mapped.predecessor_activity_code &&
      mapped.predecessor_activity &&
      /^\d{2}-\d{2}-\d{2}$/.test(mapped.predecessor_activity)
    ) {
      mapped.predecessor_activity_code = mapped.predecessor_activity;
    } else if (!mapped.predecessor_activity_code && mapped.predecessor_activity) {
      warnings.push(
        `Row ${rowNumber}: predecessor_activity "${mapped.predecessor_activity}" is legacy free text; use predecessor_activity_code when possible.`,
      );
    }

    if (mapped.activity_code && parseActivityCode(mapped.activity_code)) {
      const parsed = parseActivityCode(mapped.activity_code)!;
      mapped.activity_sequence = mapped.activity_sequence ?? parsed.activitySequence;
      mapped.line_sequence = mapped.line_sequence ?? parsed.lineSequence;
      mapped.work_package_code =
        mapped.work_package_code ?? buildWorkPackageCode(parsed.divisionCode, parsed.activitySequence);
    } else if (
      mapped.activity_sequence != null &&
      mapped.line_sequence != null &&
      !mapped.activity_code
    ) {
      mapped.activity_code = buildActivityCode(
        divisionCode,
        mapped.activity_sequence,
        mapped.line_sequence,
      );
    }

    if (mapped.labor_hours == null) {
      mapped.labor_hours = resolveLaborHours(mapped);
    }
    if (mapped.duration_days == null) {
      mapped.duration_days = resolveDurationDays(mapped, mapped.labor_hours);
    }
    if (mapped.total_cost == null || mapped.total_cost <= 0) {
      mapped.total_cost = calculateImportedTotalCost(mapped);
    }

    importedRows.push(mapped);
  });

  const initialDraftLines = importedRows.map((row, index) => mapRowToDraftLine(row, index));
  const finalized = finalizeImportedDraftLines(initialDraftLines, options);
  warnings.push(...finalized.warnings);
  errors.push(...finalized.errors);
  const selectedDivisions = buildImportedSelectedDivisions(importedRows);

  return {
    rows: importedRows,
    draftLines: finalized.draftLines,
    selectedDivisions,
    estimateSettings: options.estimateSettings,
    warnings,
    errors,
  };
}

export function previewImportedEstimate(importedData: ImportedEstimateData): EstimateImportPreview {
  const divisionCounts = new Map<string, { name: string; lineItemCount: number }>();

  for (const row of importedData.rows) {
    const existing = divisionCounts.get(row.division_code);
    if (existing) {
      existing.lineItemCount += 1;
    } else {
      divisionCounts.set(row.division_code, {
        name: row.division_name,
        lineItemCount: 1,
      });
    }
  }

  let estimatedTotal = 0;
  for (const draftLine of importedData.draftLines) {
    const preview = computeLinePreviewTotals(draftLine);
    estimatedTotal += preview.sellPrice > 0 ? preview.sellPrice : 0;
    const importedTotal = importedData.rows.find(
      (row) => row.activity_title === draftLine.task.title,
    )?.total_cost;
    if (preview.sellPrice <= 0 && importedTotal != null) {
      estimatedTotal += importedTotal;
    }
  }

  return {
    divisionCount: divisionCounts.size,
    lineItemCount: importedData.rows.length,
    estimatedTotal: Math.round(estimatedTotal * 100) / 100,
    divisions: [...divisionCounts.entries()].map(([code, value]) => ({
      code,
      name: value.name,
      lineItemCount: value.lineItemCount,
    })),
    warnings: importedData.warnings,
    errors: importedData.errors,
  };
}

function pickLineItemsSheetName(workbook: XLSX.WorkBook): string {
  const names = workbook.SheetNames;
  const exact = names.find(
    (name) => normalizeHeader(name) === normalizeHeader(ESTIMATE_IMPORT_LINE_ITEMS_SHEET_NAME),
  );
  return exact ?? names[0] ?? ESTIMATE_IMPORT_LINE_ITEMS_SHEET_NAME;
}

function parseEstimateSettingsSheet(workbook: XLSX.WorkBook): EstimateSettings | undefined {
  const sheetName = workbook.SheetNames.find(
    (name) => name.trim().toLowerCase() === ESTIMATE_SETTINGS_SHEET_NAME.toLowerCase(),
  );
  if (!sheetName) return undefined;

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return undefined;

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });
  const patch = parseEstimateSettingsSheetRows(rawRows);
  return patch ? normalizeEstimateSettings(patch) : undefined;
}

export function parseEstimateWorkbook(workbook: XLSX.WorkBook): ParseEstimateFileResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!workbook.SheetNames.length) {
    errors.push('Workbook does not contain any worksheets.');
    return { rows: [], warnings, errors };
  }

  const sheetName = pickLineItemsSheetName(workbook);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    errors.push(`Could not read worksheet "${sheetName}".`);
    return { rows: [], warnings, errors };
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  if (rawRows.length === 0) {
    errors.push('Worksheet is empty.');
    return { rows: [], warnings, errors };
  }

  const normalizedRows = normalizeImportedSheetRows(rawRows);
  const validation = validateImportedEstimate(normalizedRows);
  warnings.push(...validation.warnings);
  errors.push(...validation.errors);
  const estimateSettings = parseEstimateSettingsSheet(workbook);

  return {
    rows: normalizedRows,
    estimateSettings,
    warnings,
    errors,
  };
}

export function readEstimateWorkbookFromArrayBuffer(
  buffer: ArrayBuffer,
  fileName: string,
): XLSX.WorkBook {
  const lowerName = fileName.toLowerCase();
  const isCsv = lowerName.endsWith('.csv');
  return XLSX.read(buffer, {
    type: 'array',
    raw: false,
    ...(isCsv ? { FS: ',' } : {}),
  });
}

export async function parseEstimateFile(file: File): Promise<{
  importedData: ImportedEstimateData | null;
  preview: EstimateImportPreview | null;
  warnings: string[];
  errors: string[];
}> {
  const warnings: string[] = [];
  const errors: string[] = [];

  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.csv')) {
    errors.push('Unsupported file type. Upload a .xlsx or .csv file.');
    return { importedData: null, preview: null, warnings, errors };
  }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = readEstimateWorkbookFromArrayBuffer(buffer, file.name);
    const parsed = parseEstimateWorkbook(workbook);
    warnings.push(...parsed.warnings);
    errors.push(...parsed.errors);

    if (parsed.errors.length > 0) {
      return { importedData: null, preview: null, warnings, errors };
    }

    const importedData = mapRowsToEstimateData(parsed.rows, {
      estimateSettings: parsed.estimateSettings,
    });
    warnings.push(...importedData.warnings);
    errors.push(...importedData.errors);

    if (importedData.errors.length > 0 || importedData.rows.length === 0) {
      return { importedData: null, preview: null, warnings, errors };
    }

    const preview = previewImportedEstimate(importedData);
    return { importedData, preview, warnings, errors };
  } catch {
    errors.push('Could not read the selected file.');
    return { importedData: null, preview: null, warnings, errors };
  }
}

export function parseEstimateBuffer(
  buffer: ArrayBuffer,
  fileName: string,
): {
  importedData: ImportedEstimateData | null;
  preview: EstimateImportPreview | null;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const workbook = readEstimateWorkbookFromArrayBuffer(buffer, fileName);
    const parsed = parseEstimateWorkbook(workbook);
    warnings.push(...parsed.warnings);
    errors.push(...parsed.errors);

    if (parsed.errors.length > 0) {
      return { importedData: null, preview: null, warnings, errors };
    }

    const importedData = mapRowsToEstimateData(parsed.rows, {
      estimateSettings: parsed.estimateSettings,
    });
    warnings.push(...importedData.warnings);
    errors.push(...importedData.errors);

    if (importedData.errors.length > 0 || importedData.rows.length === 0) {
      return { importedData: null, preview: null, warnings, errors };
    }

    const preview = previewImportedEstimate(importedData);
    return { importedData, preview, warnings, errors };
  } catch {
    errors.push('Could not read the import buffer.');
    return { importedData: null, preview: null, warnings, errors };
  }
}
