import { CSI_DIVISIONS } from '../domain/csiDivisions';
import type { ActivityExcelEstimateType, EstimateExcelColumnDef } from './estimateExcelTypes';
import { ESTIMATE_EXCEL_SCHEMA_VERSION } from './estimateExcelTypes';

export const ESTIMATE_EXCEL_SHEET_NAMES = {
  instructions: 'Instructions',
  estimateInfo: 'Estimate Info',
  estimateLines: 'Estimate Lines',
  lookupValues: 'Lookup Values',
  importNotes: 'Import Notes',
  summaryByDivision: 'Summary by Division',
} as const;

export const ESTIMATE_EXCEL_LINE_COLUMNS: EstimateExcelColumnDef[] = [
  { key: 'division_code',           label: 'Division Code',           required: true,  columnWidth: 14 },
  { key: 'division_name',           label: 'Division Name',           required: true,  columnWidth: 22 },
  { key: 'activity_code',           label: 'Activity Code',           required: false, columnWidth: 14 },
  { key: 'activity_name',           label: 'Activity Name',           required: true,  columnWidth: 28 },
  { key: 'line_item_description',   label: 'Line Item Description',   required: true,  columnWidth: 34 },
  { key: 'quantity',                label: 'Quantity',                required: true,  columnWidth: 10 },
  { key: 'unit',                    label: 'Unit',                    required: true,  columnWidth: 8  },
  { key: 'production_rate_id',      label: 'Production Rate ID',      required: false, columnWidth: 28 },
  { key: 'man_hours_per_unit',      label: 'Man Hours Per Unit',      required: false, columnWidth: 18 },
  { key: 'crew_size',               label: 'Crew Size',               required: false, columnWidth: 10 },
  { key: 'labor_role',              label: 'Labor Role',              required: false, columnWidth: 16 },
  { key: 'material_unit_cost',      label: 'Material Unit Cost',      required: false, columnWidth: 18 },
  { key: 'equipment_unit_cost',     label: 'Equipment Unit Cost',     required: false, columnWidth: 18 },
  { key: 'subcontractor_unit_cost', label: 'Subcontractor Unit Cost', required: false, columnWidth: 22 },
  { key: 'schedule_enabled',        label: 'Schedule Enabled',        required: false, columnWidth: 16 },
  { key: 'notes',                   label: 'Notes',                   required: false, columnWidth: 30 },
];

export const ESTIMATE_EXCEL_COMMON_UNITS = [
  'CY',
  'SF',
  'LF',
  'EA',
  'LS',
  'TON',
  'HR',
  'DAY',
  'GAL',
  'LB',
] as const;

export const ESTIMATE_EXCEL_SAMPLE_PRODUCTION_RATE_IDS = [
  '03-31-00-footings-direct-chute',
  '03-11-13.65-0040',
  '06-10-00-0100',
] as const;

export const ESTIMATE_EXCEL_INSTRUCTIONS = [
  'Arden Project OS — Detailed / Bid Estimate Excel Template',
  '',
  'Do not edit schema_version, estimate_type, or sheet structure.',
  'Fill in Estimate Lines only. Arden recalculates all totals internally.',
  'Do not rely on Excel formulas or user-entered totals.',
  '',
  'Required columns: division_code, division_name, activity_name, line_item_description, quantity, unit.',
  'Rows with the same division_code + activity_code (or activity_name) become one construction activity.',
  'production_rate_id is optional. If blank, provide man_hours_per_unit or import as unpriced shell.',
  'Use the matching template for your estimate type (detailed or bid).',
] as const;

export function getSchemaForEstimateType(estimateType: ActivityExcelEstimateType) {
  return {
    schemaVersion: ESTIMATE_EXCEL_SCHEMA_VERSION,
    estimateType,
    lineColumns: ESTIMATE_EXCEL_LINE_COLUMNS,
    sheetNames: ESTIMATE_EXCEL_SHEET_NAMES,
  };
}

export function buildSampleLineRow(
  estimateType: ActivityExcelEstimateType,
): Record<string, string | number> {
  void estimateType;
  return {
    division_code: '03',
    division_name: 'Concrete',
    activity_code: '03-01-03',
    activity_name: 'Place footing concrete',
    line_item_description: 'Direct chute footing concrete',
    quantity: 50,
    unit: 'CY',
    production_rate_id: '03-31-00-footings-direct-chute',
    man_hours_per_unit: 0.337,
    crew_size: 4,
    labor_role: '',
    material_unit_cost: 170,
    equipment_unit_cost: 9,
    subcontractor_unit_cost: 0,
    schedule_enabled: 'TRUE',
    notes: 'Sample row — replace with your estimate lines',
  };
}

export function buildLookupValuesRows(): string[][] {
  const rows: string[][] = [
    ['Lookup Values'],
    [''],
    ['CSI Divisions', 'Code', 'Name'],
  ];
  for (const division of CSI_DIVISIONS.slice(0, 20)) {
    rows.push(['division', division.code, division.name]);
  }
  rows.push(['']);
  rows.push(['Common Units']);
  for (const unit of ESTIMATE_EXCEL_COMMON_UNITS) {
    rows.push(['unit', unit]);
  }
  rows.push(['']);
  rows.push(['Example production_rate_id values']);
  for (const id of ESTIMATE_EXCEL_SAMPLE_PRODUCTION_RATE_IDS) {
    rows.push(['production_rate_id', id]);
  }
  return rows;
}

export function normalizeHeaderKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export const ESTIMATE_EXCEL_HEADER_ALIASES: Record<string, string> = {
  divisioncode: 'division_code',
  divisionname: 'division_name',
  activitycode: 'activity_code',
  activityname: 'activity_name',
  lineitemdescription: 'line_item_description',
  description: 'line_item_description',
  productionrateid: 'production_rate_id',
  manhoursperunit: 'man_hours_per_unit',
  crewsize: 'crew_size',
  laborrole: 'labor_role',
  materialunitcost: 'material_unit_cost',
  equipmentunitcost: 'equipment_unit_cost',
  subcontractorunitcost: 'subcontractor_unit_cost',
  scheduleenabled: 'schedule_enabled',
};
