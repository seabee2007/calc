export const CONCRETE_CALC_BID_ESTIMATE_TEMPLATE_NAME = 'Concrete Calc Bid Estimate Template';

export const ESTIMATE_IMPORT_TEMPLATE_VERSION = '1.1';

export const ESTIMATE_IMPORT_REQUIRED_COLUMNS = [
  'division_code',
  'division_name',
  'activity_title',
  'quantity',
  'unit',
] as const;

export const ESTIMATE_IMPORT_OPTIONAL_COLUMNS = [
  'activity_code',
  'work_package',
  'work_package_code',
  'work_package_name',
  'activity_sequence',
  'line_sequence',
  'description',
  'labor_hours',
  'labor_rate',
  'labor_cost',
  'material_cost',
  'equipment_cost',
  'subcontractor_cost',
  'overhead_percent',
  'profit_percent',
  'total_cost',
  'duration_days',
  'crew_size',
  'predecessor_activity_code',
  'relationship_type',
  'lag_days',
  'predecessor_activity',
  'notes',
] as const;

export const ESTIMATE_IMPORT_ALL_COLUMNS = [
  ...ESTIMATE_IMPORT_REQUIRED_COLUMNS,
  ...ESTIMATE_IMPORT_OPTIONAL_COLUMNS,
] as const;

export type EstimateImportRequiredColumn = (typeof ESTIMATE_IMPORT_REQUIRED_COLUMNS)[number];
export type EstimateImportOptionalColumn = (typeof ESTIMATE_IMPORT_OPTIONAL_COLUMNS)[number];
export type EstimateImportColumn = (typeof ESTIMATE_IMPORT_ALL_COLUMNS)[number];

export const ESTIMATE_IMPORT_LINE_ITEMS_SHEET_NAME = 'Line Items';
export const ESTIMATE_IMPORT_ESTIMATE_INFO_SHEET_NAME = 'Estimate Info';
export const ESTIMATE_IMPORT_SUMMARY_SHEET_NAME = 'Summary';

export const ESTIMATE_IMPORT_TEMPLATE_GUIDANCE = [
  'Required columns: division_code, division_name, activity_title, quantity, unit.',
  'Activity codes use DIVISION-ACTIVITY-LINE format (for example 03-01-02).',
  'Use two-digit CSI division codes (for example 03 for Concrete).',
  'Predecessors should reference activity_code values (predecessor_activity_code).',
  'If total_cost is blank, it is calculated from cost columns plus overhead and profit.',
] as const;

export const ESTIMATE_IMPORT_TEMPLATE_SAMPLE_ROW: Record<EstimateImportColumn, string | number> = {
  division_code: '03',
  division_name: 'Concrete',
  activity_title: 'Place and finish slab',
  quantity: 1200,
  unit: 'SF',
  activity_code: '03-01-02',
  work_package: 'Slab on Grade',
  work_package_code: '03-01',
  work_package_name: 'Slab on Grade',
  activity_sequence: 1,
  line_sequence: 2,
  description: '4-inch interior slab on grade',
  labor_hours: 96,
  labor_rate: 45,
  labor_cost: 4320,
  material_cost: 8400,
  equipment_cost: 600,
  subcontractor_cost: 0,
  overhead_percent: 10,
  profit_percent: 8,
  total_cost: 0,
  duration_days: 3,
  crew_size: 4,
  predecessor_activity_code: '03-01-01',
  relationship_type: 'FS',
  lag_days: 0,
  predecessor_activity: '',
  notes: 'Sample row — replace with your estimate lines',
};
