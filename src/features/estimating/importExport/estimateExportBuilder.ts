import * as XLSX from 'xlsx';
import type { CurrentEstimate } from '../application/currentEstimateService';
import { compareActivityCodes } from '../application/estimateActivityCoding';
import { draftLineFromDomainTask } from '../application/estimateDraftLine';
import { computeLinePreviewTotals } from '../ui/estimateFormDefaults';
import { getCsiDivisionByCode } from '../domain/csiDivisions';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import {
  DEFAULT_ESTIMATE_SETTINGS,
  ESTIMATE_SETTINGS_SHEET_NAME,
  estimateSettingsRowsForExport,
  parseEstimateSettingsFromAssumptions,
} from '../application/estimateSettings';
import {
  CONCRETE_CALC_BID_ESTIMATE_TEMPLATE_NAME,
  ESTIMATE_IMPORT_ALL_COLUMNS,
  ESTIMATE_IMPORT_ESTIMATE_INFO_SHEET_NAME,
  ESTIMATE_IMPORT_LINE_ITEMS_SHEET_NAME,
  ESTIMATE_IMPORT_SUMMARY_SHEET_NAME,
  ESTIMATE_IMPORT_TEMPLATE_GUIDANCE,
  ESTIMATE_IMPORT_TEMPLATE_SAMPLE_ROW,
  ESTIMATE_IMPORT_TEMPLATE_VERSION,
  type EstimateImportColumn,
} from './estimateImportColumns';

export interface EstimateExportRow {
  activity_code: string;
  division_code: string;
  division_name: string;
  work_package: string;
  work_package_code: string;
  work_package_name: string;
  activity_sequence: number | '';
  line_sequence: number | '';
  activity_title: string;
  description: string;
  quantity: number;
  unit: string;
  labor_hours: number | '';
  labor_rate: number | '';
  labor_cost: number | '';
  material_cost: number | '';
  equipment_cost: number | '';
  subcontractor_cost: number | '';
  overhead_percent: number | '';
  profit_percent: number | '';
  total_cost: number | '';
  duration_days: number | '';
  crew_size: number | '';
  predecessor_activity_code: string;
  relationship_type: string;
  lag_days: number | '';
  predecessor_activity: string;
  notes: string;
}

function parseImportedEstimateRecord(task: EstimateDomainTask): Record<string, unknown> {
  const imported = task.calculatedValues.importedEstimate;
  if (!imported || typeof imported !== 'object' || Array.isArray(imported)) return {};
  return imported as Record<string, unknown>;
}

function toNumberOrBlank(value: unknown): number | '' {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : '';
  }
  return '';
}

function taskToExportRow(
  task: EstimateDomainTask,
  divisionNameByCode: Map<string, string>,
): EstimateExportRow {
  const draft = draftLineFromDomainTask(task);
  const preview = computeLinePreviewTotals(draft);
  const imported = parseImportedEstimateRecord(task);
  const metrics = task.calculatedValues.metrics;
  const costs = task.calculatedValues.costs;
  const costsRecord =
    costs && typeof costs === 'object' && !Array.isArray(costs)
      ? (costs as Record<string, unknown>)
      : {};

  const divisionCode = task.lineItem.csiDivision ?? '';
  const divisionName =
    divisionNameByCode.get(divisionCode) ??
    getCsiDivisionByCode(divisionCode)?.name ??
    divisionCode;

  const laborHours =
    toNumberOrBlank(metrics && typeof metrics === 'object' ? (metrics as Record<string, unknown>).adjustedLaborHours : undefined) ||
    toNumberOrBlank(metrics && typeof metrics === 'object' ? (metrics as Record<string, unknown>).laborHours : undefined) ||
    toNumberOrBlank(imported.laborHours) ||
    preview.laborHours ||
    '';

  return {
    activity_code: task.activityCode ?? '',
    division_code: divisionCode,
    division_name: task.divisionName ?? divisionName,
    work_package: task.workPackageName ?? task.scopeName ?? '',
    work_package_code: task.workPackageCode ?? '',
    work_package_name: task.workPackageName ?? task.scopeName ?? '',
    activity_sequence: task.activitySequence ?? '',
    line_sequence: task.lineSequence ?? '',
    activity_title: task.title ?? task.lineItem.description ?? '',
    description: task.lineItem.description ?? task.description ?? '',
    quantity: task.lineItem.quantity.quantity ?? 0,
    unit:
      (typeof task.calculatedValues.unit === 'string' && task.calculatedValues.unit) ||
      draft.unit ||
      '',
    labor_hours: laborHours,
    labor_rate: toNumberOrBlank(task.lineItem.labor.laborRate) || '',
    labor_cost:
      toNumberOrBlank(costsRecord.totalLaborCost) ||
      toNumberOrBlank(imported.laborCost) ||
      preview.laborCost ||
      '',
    material_cost:
      toNumberOrBlank(costsRecord.materialCost) ||
      toNumberOrBlank(imported.materialCost) ||
      preview.materialCost ||
      '',
    equipment_cost:
      toNumberOrBlank(costsRecord.equipmentCost) ||
      toNumberOrBlank(imported.equipmentCost) ||
      preview.equipmentCost ||
      '',
    subcontractor_cost:
      toNumberOrBlank(costsRecord.subcontractorCost) ||
      toNumberOrBlank(imported.subcontractorCost) ||
      preview.subcontractorCost ||
      '',
    overhead_percent: toNumberOrBlank(task.overheadPercent) || '',
    profit_percent: toNumberOrBlank(task.profitPercent) || '',
    total_cost:
      toNumberOrBlank(imported.totalCost) ||
      preview.sellPrice ||
      '',
    duration_days:
      toNumberOrBlank(metrics && typeof metrics === 'object' ? (metrics as Record<string, unknown>).durationDays : undefined) ||
      toNumberOrBlank(imported.durationDays) ||
      preview.durationDays ||
      '',
    crew_size: toNumberOrBlank(task.lineItem.labor.crewSize) || '',
    predecessor_activity_code:
      task.predecessorActivityCode ??
      (typeof imported.predecessorActivityCode === 'string'
        ? imported.predecessorActivityCode
        : ''),
    relationship_type: task.relationshipType ?? 'FS',
    lag_days: task.lagDays ?? 0,
    predecessor_activity:
      (typeof imported.predecessorActivity === 'string' && imported.predecessorActivity) || '',
    notes: (typeof imported.notes === 'string' && imported.notes) || '',
  };
}

function buildDivisionNameMap(estimate: CurrentEstimate): Map<string, string> {
  const map = new Map<string, string>();
  for (const division of estimate.selectedDivisions) {
    map.set(division.code, division.name);
  }
  return map;
}

function exportRowsFromEstimate(estimate: CurrentEstimate): EstimateExportRow[] {
  const divisionNameByCode = buildDivisionNameMap(estimate);
  return [...estimate.lineItems]
    .sort(
      (left, right) =>
        compareActivityCodes(left.activityCode, right.activityCode) ||
        left.position - right.position,
    )
    .map((task) => taskToExportRow(task, divisionNameByCode));
}

function rowToSheetRecord(row: EstimateExportRow): Record<EstimateImportColumn, string | number> {
  return {
    activity_code: row.activity_code,
    division_code: row.division_code,
    division_name: row.division_name,
    work_package: row.work_package,
    work_package_code: row.work_package_code,
    work_package_name: row.work_package_name,
    activity_sequence: row.activity_sequence,
    line_sequence: row.line_sequence,
    activity_title: row.activity_title,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    labor_hours: row.labor_hours,
    labor_rate: row.labor_rate,
    labor_cost: row.labor_cost,
    material_cost: row.material_cost,
    equipment_cost: row.equipment_cost,
    subcontractor_cost: row.subcontractor_cost,
    overhead_percent: row.overhead_percent,
    profit_percent: row.profit_percent,
    total_cost: row.total_cost,
    duration_days: row.duration_days,
    crew_size: row.crew_size,
    predecessor_activity_code: row.predecessor_activity_code,
    relationship_type: row.relationship_type,
    lag_days: row.lag_days,
    predecessor_activity: row.predecessor_activity,
    notes: row.notes,
  };
}

function buildSummaryRows(
  estimate: CurrentEstimate,
  exportRows: EstimateExportRow[],
  projectName: string,
) {
  const byDivision = new Map<string, { name: string; lineItems: number; total: number }>();

  for (const row of exportRows) {
    const existing = byDivision.get(row.division_code) ?? {
      name: row.division_name,
      lineItems: 0,
      total: 0,
    };
    existing.lineItems += 1;
    if (typeof row.total_cost === 'number') existing.total += row.total_cost;
    byDivision.set(row.division_code, existing);
  }

  const summaryRows = [['division_code', 'division_name', 'line_items', 'total_cost']];
  let grandTotal = 0;
  for (const [code, value] of byDivision.entries()) {
    summaryRows.push([code, value.name, value.lineItems, Math.round(value.total * 100) / 100]);
    grandTotal += value.total;
  }
  summaryRows.push(['', 'Grand total', exportRows.length, Math.round(grandTotal * 100) / 100]);

  const infoRows = [
    ['field', 'value'],
    ['template', CONCRETE_CALC_BID_ESTIMATE_TEMPLATE_NAME],
    ['template_version', ESTIMATE_IMPORT_TEMPLATE_VERSION],
    ['project_name', projectName],
    ['estimate_type', estimate.estimateType ?? 'bid'],
    ['exported_at', new Date().toISOString()],
    ['line_item_count', exportRows.length],
    ['division_count', byDivision.size],
  ];

  return { infoRows, summaryRows, grandTotal };
}

export function sanitizeEstimateExportFileStem(value: string): string {
  const trimmed = value.trim() || 'project';
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function buildEstimateExportFileName(projectName: string, date = new Date()): string {
  const stem = sanitizeEstimateExportFileStem(projectName);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${stem}-bid-estimate-${year}-${month}-${day}.xlsx`;
}

export function buildEstimateWorkbook(
  estimate: CurrentEstimate,
  projectName: string,
): XLSX.WorkBook {
  const exportRows = exportRowsFromEstimate(estimate);
  const { infoRows, summaryRows } = buildSummaryRows(estimate, exportRows, projectName);

  const lineItemSheetRows = [
    [...ESTIMATE_IMPORT_ALL_COLUMNS],
    ...exportRows.map((row) =>
      ESTIMATE_IMPORT_ALL_COLUMNS.map((column) => rowToSheetRecord(row)[column]),
    ),
  ];

  const workbook = XLSX.utils.book_new();
  const infoSheet = XLSX.utils.aoa_to_sheet(infoRows);
  const lineItemsSheet = XLSX.utils.aoa_to_sheet(lineItemSheetRows);
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);

  const settings = parseEstimateSettingsFromAssumptions(estimate.assumptions);
  const settingsRows = [
    ['setting', 'value'],
    ...estimateSettingsRowsForExport(settings).map((row) => [row.setting, row.value]),
  ];
  const settingsSheet = XLSX.utils.aoa_to_sheet(settingsRows);

  XLSX.utils.book_append_sheet(workbook, infoSheet, ESTIMATE_IMPORT_ESTIMATE_INFO_SHEET_NAME);
  XLSX.utils.book_append_sheet(workbook, settingsSheet, ESTIMATE_SETTINGS_SHEET_NAME);
  XLSX.utils.book_append_sheet(workbook, lineItemsSheet, ESTIMATE_IMPORT_LINE_ITEMS_SHEET_NAME);
  XLSX.utils.book_append_sheet(workbook, summarySheet, ESTIMATE_IMPORT_SUMMARY_SHEET_NAME);

  return workbook;
}

export function buildEstimateCsv(estimate: CurrentEstimate): string {
  const exportRows = exportRowsFromEstimate(estimate);
  const sheetRows = [
    [...ESTIMATE_IMPORT_ALL_COLUMNS],
    ...exportRows.map((row) =>
      ESTIMATE_IMPORT_ALL_COLUMNS.map((column) => rowToSheetRecord(row)[column]),
    ),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
  return XLSX.utils.sheet_to_csv(sheet);
}

export function buildBlankEstimateTemplateWorkbook(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  const infoRows = [
    ['field', 'value'],
    ['template', CONCRETE_CALC_BID_ESTIMATE_TEMPLATE_NAME],
    ['template_version', ESTIMATE_IMPORT_TEMPLATE_VERSION],
    ...ESTIMATE_IMPORT_TEMPLATE_GUIDANCE.map((line) => ['guidance', line]),
  ];
  const lineItemRows = [
    [...ESTIMATE_IMPORT_ALL_COLUMNS],
    ESTIMATE_IMPORT_ALL_COLUMNS.map((column) => ESTIMATE_IMPORT_TEMPLATE_SAMPLE_ROW[column]),
  ];
  const summaryRows = [
    ['division_code', 'division_name', 'line_items', 'total_cost'],
    ['03', 'Concrete', 1, ESTIMATE_IMPORT_TEMPLATE_SAMPLE_ROW.total_cost],
  ];

  const templateSettingsRows = [
    ['setting', 'value'],
    ...estimateSettingsRowsForExport(DEFAULT_ESTIMATE_SETTINGS).map((row) => [
      row.setting,
      row.value,
    ]),
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(infoRows),
    ESTIMATE_IMPORT_ESTIMATE_INFO_SHEET_NAME,
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(templateSettingsRows),
    ESTIMATE_SETTINGS_SHEET_NAME,
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(lineItemRows),
    ESTIMATE_IMPORT_LINE_ITEMS_SHEET_NAME,
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(summaryRows),
    ESTIMATE_IMPORT_SUMMARY_SHEET_NAME,
  );

  return workbook;
}

export function workbookToArrayBuffer(workbook: XLSX.WorkBook): ArrayBuffer {
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return output;
}

export function downloadWorkbook(workbook: XLSX.WorkBook, fileName: string): void {
  const buffer = workbookToArrayBuffer(workbook);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadEstimateWorkbook(
  estimate: CurrentEstimate,
  projectName: string,
  date = new Date(),
): void {
  const workbook = buildEstimateWorkbook(estimate, projectName);
  downloadWorkbook(workbook, buildEstimateExportFileName(projectName, date));
}

export function downloadEstimateCsv(
  estimate: CurrentEstimate,
  projectName: string,
  date = new Date(),
): void {
  const csv = buildEstimateCsv(estimate);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const stem = sanitizeEstimateExportFileStem(projectName);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  anchor.download = `${stem}-bid-estimate-${year}-${month}-${day}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadBlankEstimateTemplateWorkbook(): void {
  downloadWorkbook(
    buildBlankEstimateTemplateWorkbook(),
    'concrete-calc-bid-estimate-template.xlsx',
  );
}
