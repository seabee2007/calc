export const CONCRETE_CALC_BID_ESTIMATE_TEMPLATE_NAME = 'Arden Project OS Bid Estimate Template';

export const ESTIMATE_IMPORT_TEMPLATE_VERSION = '2.0';

// ── Required columns ─────────────────────────────────────────────────────────

export const ESTIMATE_IMPORT_REQUIRED_COLUMNS = [
  'division_code',
  'division_name',
  'activity_title',
  'quantity',
  'unit',
] as const;

// ── Optional columns ──────────────────────────────────────────────────────────
// Columns added in v2.0 are marked with a comment.
// activity_sequence, line_sequence, predecessor_activity, overhead_percent, profit_percent
// are kept for backward-compatible import of v1.x files; new exports use the
// _override variants or project-level Estimate Settings instead.

export const ESTIMATE_IMPORT_OPTIONAL_COLUMNS = [
  'activity_code',
  'work_package',
  'work_package_code',
  'work_package_name',
  // v2.0 — classification
  'csi_code',
  'csi_section',
  // v2.0 — production rate bridge (the primary labor-rate linkage)
  'production_rate_id',
  'production_rate_type',
  'man_hours_per_unit',
  // costs
  'indirect_cost',           // v2.0
  'labor_hours',
  'labor_rate',
  'labor_cost',
  'material_cost',
  'equipment_cost',
  'subcontractor_cost',
  // markup — project-level is preferred; per-line overrides kept for flexibility
  'overhead_percent_override', // v2.0 — explicit name for per-line override
  'profit_percent_override',   // v2.0 — explicit name for per-line override
  'overhead_percent',          // backward compat (v1.x)
  'profit_percent',            // backward compat (v1.x)
  'total_cost',
  // schedule
  'duration_days',
  'crew_size',
  'predecessor_activity_code',
  'relationship_type',
  'lag_days',
  // v2.0 — activity classification
  'is_custom_activity',
  'activity_type',
  // deprecated — kept for backward-compatible round-trip of v1.x files
  'activity_sequence',
  'line_sequence',
  'predecessor_activity',
  'description',
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

// ── Template guidance ─────────────────────────────────────────────────────────

export const ESTIMATE_IMPORT_TEMPLATE_GUIDANCE = [
  'Required columns: division_code, division_name, activity_title, quantity, unit.',
  'Activity codes are fixed master activity codes (DD-PP-SS), e.g. 03-01-03 always means Place footing concrete.',
  'Do not generate activity codes by row order — use the exact code from the residential activity master dataset.',
  'production_rate_id is the labor-rate bridge: it links an activity to a specific production rate record.',
  'CSI fields (csi_code, csi_section) are for classification only and are not used for production rate lookup.',
  'man_hours_per_unit = bare man-hours per unit (bareManHoursPerUnit from the production rate record).',
  'labor_hours = quantity × man_hours_per_unit; duration_days = labor_hours / (crew_size × hours_per_day).',
  'crew_size is the activity labor demand; project_crew_size is the available resource pool (Estimate Settings).',
  'overhead_percent and profit_percent are project-level settings — set them in the Estimate Settings sheet.',
  'Per-line markup overrides may be stored in overhead_percent_override / profit_percent_override if needed.',
  'relationship_type values: FS (finish-to-start), SS, FF, SF.',
  'production_rate_type should be labor_hours_per_unit for labor-loaded activities.',
  'Unknown production_rate_id imports as a warning, not an error; totals are recalculated by the app.',
  'Unknown activity_code imports as a custom activity; its code and title are preserved unchanged.',
] as const;

// ── Sample row ────────────────────────────────────────────────────────────────
// Uses master activity 03-01-03 (Place footing concrete) linked to production
// rate 03-31-00-footings-direct-chute (0.337 MH/CY).
// labor_hours = 50 × 0.337 = 16.85 → 17; duration = 17 / (4 × 8) ≈ 1 day.
// total_cost = labor_cost(17×65=1105) + material(8500) + equipment(450) = 10055.

export const ESTIMATE_IMPORT_TEMPLATE_SAMPLE_ROW: Record<EstimateImportColumn, string | number> = {
  // required
  division_code: '03',
  division_name: 'Concrete',
  activity_title: 'Place footing concrete',
  quantity: 50,
  unit: 'CY',
  // activity identity
  activity_code: '03-01-03',
  work_package: 'Footing Concrete',
  work_package_code: '03-01',
  work_package_name: 'Footing Concrete',
  // CSI classification (not used for production rate lookup)
  csi_code: '03 31 00',
  csi_section: '03 31 00',
  // production rate bridge
  production_rate_id: '03-31-00-footings-direct-chute',
  production_rate_type: 'labor_hours_per_unit',
  man_hours_per_unit: 0.337,
  // costs
  indirect_cost: 0,
  labor_hours: 17,
  labor_rate: 65,
  labor_cost: 1105,
  material_cost: 8500,
  equipment_cost: 450,
  subcontractor_cost: 0,
  // markup — blank = use project-level Estimate Settings
  overhead_percent_override: '',
  profit_percent_override: '',
  overhead_percent: 0,
  profit_percent: 0,
  total_cost: 10055,
  // schedule
  duration_days: 1,
  crew_size: 4,
  predecessor_activity_code: '03-01-02',
  relationship_type: 'FS',
  lag_days: 0,
  // activity classification
  is_custom_activity: '',
  activity_type: '',
  // deprecated v1.x fields (kept for backward compat)
  activity_sequence: 1,
  line_sequence: 3,
  predecessor_activity: '',
  description: 'Direct chute footing concrete — 50 CY',
  notes: 'Sample row — replace with your estimate lines',
};
