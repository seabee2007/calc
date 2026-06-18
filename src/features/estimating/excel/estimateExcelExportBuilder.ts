import * as XLSX from 'xlsx';
import type { ProjectActivityLineItem, ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import { compareActivityCodes } from '../application/estimateActivityCoding';
import { getCsiDivisionByCode } from '../domain/csiDivisions';
import type { ActivityExcelEstimateType, ActivityExcelExportInput } from './estimateExcelTypes';
import { ESTIMATE_EXCEL_SCHEMA_VERSION } from './estimateExcelTypes';
import {
  ESTIMATE_EXCEL_INSTRUCTIONS,
  ESTIMATE_EXCEL_LINE_COLUMNS,
  ESTIMATE_EXCEL_SHEET_NAMES,
  buildLookupValuesRows,
} from './estimateExcelSchemas';
import { downloadWorkbook } from './estimateExcelDownload';

function formatBoolean(value: boolean): string {
  return value ? 'TRUE' : 'FALSE';
}

function activityToExportRows(
  activity: ProjectConstructionActivity,
  lineItems: readonly ProjectActivityLineItem[],
): Record<string, string | number>[] {
  const division = getCsiDivisionByCode(activity.divisionCode);
  const divisionName = activity.divisionName.trim() || division?.name || activity.divisionCode;

  return [...lineItems]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((item) => ({
      division_code: activity.divisionCode,
      division_name: divisionName,
      activity_code: activity.activityCode,
      activity_name: activity.baseTitle || activity.title,
      line_item_description: item.description || item.name,
      quantity: item.quantity,
      unit: item.unit,
      production_rate_id: item.sourceProductionRateKey ?? item.productionRateId ?? '',
      man_hours_per_unit: item.manHoursPerUnit,
      crew_size: activity.crewSize,
      labor_role: item.laborRoleName ?? item.laborRoleKey ?? '',
      material_unit_cost:
        item.quantity > 0 ? Number((item.materialCost / item.quantity).toFixed(4)) : 0,
      equipment_unit_cost:
        item.quantity > 0 ? Number((item.equipmentCost / item.quantity).toFixed(4)) : 0,
      subcontractor_unit_cost:
        item.quantity > 0 ? Number(((item.subcontractCost ?? 0) / item.quantity).toFixed(4)) : 0,
      schedule_enabled: formatBoolean(activity.scheduleEnabled),
      notes: activity.notes ?? '',
    }));
}

function buildSummaryByDivisionRows(
  activities: readonly ProjectConstructionActivity[],
  lineItemsByActivityId: ReadonlyMap<string, readonly ProjectActivityLineItem[]>,
): string[][] {
  const totals = new Map<
    string,
    { divisionName: string; activityCount: number; lineCount: number; totalCost: number }
  >();

  for (const activity of activities) {
    const code = activity.divisionCode;
    const division = getCsiDivisionByCode(code);
    const entry = totals.get(code) ?? {
      divisionName: activity.divisionName.trim() || division?.name || code,
      activityCount: 0,
      lineCount: 0,
      totalCost: 0,
    };
    entry.activityCount += 1;
    const lineItems = lineItemsByActivityId.get(activity.id) ?? [];
    entry.lineCount += lineItems.length;
    entry.totalCost += activity.totalCost ?? 0;
    totals.set(code, entry);
  }

  const rows: string[][] = [
    ['division_code', 'division_name', 'activity_count', 'line_item_count', 'total_cost'],
  ];
  for (const [code, entry] of [...totals.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    rows.push([
      code,
      entry.divisionName,
      String(entry.activityCount),
      String(entry.lineCount),
      entry.totalCost.toFixed(2),
    ]);
  }
  return rows;
}

export function buildActivityExcelExportWorkbook(input: ActivityExcelExportInput): XLSX.WorkBook {
  const headers = ESTIMATE_EXCEL_LINE_COLUMNS.map((column) => column.key);
  const sortedActivities = [...input.activities].sort((a, b) =>
    compareActivityCodes(a.activityCode, b.activityCode),
  );
  const exportRows = sortedActivities.flatMap((activity) =>
    activityToExportRows(activity, input.lineItemsByActivityId.get(activity.id) ?? []),
  );
  const lineSheetRows = [
    headers,
    ...exportRows.map((row) => headers.map((key) => row[key as keyof typeof row] ?? '')),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(ESTIMATE_EXCEL_INSTRUCTIONS.map((line) => [line])),
    ESTIMATE_EXCEL_SHEET_NAMES.instructions,
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Field', 'Value'],
      ['schema_version', ESTIMATE_EXCEL_SCHEMA_VERSION],
      ['estimate_type', input.estimateType],
      ['template_generated_at', new Date().toISOString()],
      ['project_name', input.projectName],
    ]),
    ESTIMATE_EXCEL_SHEET_NAMES.estimateInfo,
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(lineSheetRows),
    ESTIMATE_EXCEL_SHEET_NAMES.estimateLines,
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(buildLookupValuesRows()),
    ESTIMATE_EXCEL_SHEET_NAMES.lookupValues,
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Import Notes'],
      ...(input.exportNotes ?? ['Exported from Arden Project OS. Totals are recalculated on import.']).map(
        (note) => [note],
      ),
    ]),
    ESTIMATE_EXCEL_SHEET_NAMES.importNotes,
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(
      buildSummaryByDivisionRows(input.activities, input.lineItemsByActivityId),
    ),
    ESTIMATE_EXCEL_SHEET_NAMES.summaryByDivision,
  );
  return workbook;
}

export function downloadActivityExcelExport(input: ActivityExcelExportInput): void {
  const safeProject = input.projectName.trim() || 'project';
  const workbook = buildActivityExcelExportWorkbook(input);
  downloadWorkbook(workbook, `${safeProject}-${input.estimateType}-estimate-export.xlsx`);
}

export function mapLoadedActivitiesToExportInput(
  estimateType: ActivityExcelEstimateType,
  projectName: string,
  loaded: Array<{ activity: ProjectConstructionActivity; lineItems: ProjectActivityLineItem[] }>,
): ActivityExcelExportInput {
  const lineItemsByActivityId = new Map<string, readonly ProjectActivityLineItem[]>(
    loaded.map((entry) => [entry.activity.id, entry.lineItems]),
  );
  return {
    estimateType,
    projectName,
    activities: loaded.map((entry) => entry.activity),
    lineItemsByActivityId,
  };
}
