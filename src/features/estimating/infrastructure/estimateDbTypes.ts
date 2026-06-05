import type {
  EstimateCostTotals,
  EstimateLineItemInput,
  EstimateSnapshot,
  EstimateStatus,
  EstimateType,
  EquipmentRateType,
  EstimateQuantityFormula,
  ProductionRateType,
} from '../domain/estimateTypes';

/** Result wrapper for repository methods — never throws for Supabase failures. */
export type RepositoryResult<T> = {
  data: T | null;
  error: string | null;
};

export type EstimateLineItemType =
  | 'division'
  | 'scope'
  | 'assembly'
  | 'task'
  | 'material'
  | 'equipment'
  | 'subcontractor'
  | 'indirect';

/** Row shape for `estimates` (snake_case, matches Phase 1C schema). */
export interface EstimateRow {
  id: string;
  project_id: string;
  name: string;
  status: EstimateStatus;
  current_version_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type EstimateInsert = {
  project_id: string;
  name?: string;
  status?: EstimateStatus;
  current_version_id?: string | null;
  created_by?: string | null;
};

export type EstimateUpdate = {
  name?: string;
  status?: EstimateStatus;
  current_version_id?: string | null;
};

/** Row shape for `estimate_versions` (snake_case). */
export interface EstimateVersionRow {
  id: string;
  estimate_id: string;
  project_id: string;
  version_number: number;
  version_name: string;
  estimate_type: EstimateType;
  status: EstimateStatus;
  snapshot: Record<string, unknown>;
  totals: Record<string, unknown>;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type EstimateVersionInsert = {
  estimate_id: string;
  project_id: string;
  version_number: number;
  version_name: string;
  estimate_type?: EstimateType;
  status?: EstimateStatus;
  snapshot?: Record<string, unknown>;
  totals?: Record<string, unknown>;
  notes?: string | null;
  created_by?: string | null;
};

/** Row shape for `estimate_line_items` (snake_case). */
export interface EstimateLineItemRow {
  id: string;
  estimate_version_id: string;
  project_id: string;
  parent_line_item_id: string | null;
  line_type: EstimateLineItemType;
  csi_division: string | null;
  csi_section: string | null;
  scope_name: string | null;
  title: string;
  description: string | null;
  trade: string | null;
  activity: string | null;
  quantity: number;
  unit: string | null;
  production_rate: number;
  production_rate_type: ProductionRateType | null;
  crew_size: number;
  hours_per_day: number;
  labor_rate: number;
  burden_percent: number;
  overhead_percent: number;
  profit_percent: number;
  contingency_percent: number;
  tax_percent: number;
  waste_percent: number;
  difficulty_factor: number;
  location_factor: number;
  material_cost: number;
  equipment_cost: number;
  subcontractor_cost: number;
  indirect_cost: number;
  calculated_values: Record<string, unknown>;
  schedule_enabled: boolean;
  weather_sensitive: boolean;
  inspection_required: boolean;
  position: number;
  created_at: string;
}

export type EstimateLineItemInsert = {
  estimate_version_id: string;
  project_id: string;
  parent_line_item_id?: string | null;
  line_type?: EstimateLineItemType;
  csi_division?: string | null;
  csi_section?: string | null;
  scope_name?: string | null;
  title: string;
  description?: string | null;
  trade?: string | null;
  activity?: string | null;
  quantity?: number;
  unit?: string | null;
  production_rate?: number;
  production_rate_type?: ProductionRateType | null;
  crew_size?: number;
  hours_per_day?: number;
  labor_rate?: number;
  burden_percent?: number;
  overhead_percent?: number;
  profit_percent?: number;
  contingency_percent?: number;
  tax_percent?: number;
  waste_percent?: number;
  difficulty_factor?: number;
  location_factor?: number;
  material_cost?: number;
  equipment_cost?: number;
  subcontractor_cost?: number;
  indirect_cost?: number;
  calculated_values?: Record<string, unknown>;
  schedule_enabled?: boolean;
  weather_sensitive?: boolean;
  inspection_required?: boolean;
  position?: number;
};

/** CamelCase summary returned by the repository for `estimates` rows. */
export interface EstimateSummary {
  id: string;
  projectId: string;
  name: string;
  status: EstimateStatus;
  currentVersionId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Domain-facing task shape used by mappers between DB rows and the pure engine.
 * Wraps `EstimateLineItemInput` plus planner/schedule metadata stored on line items.
 */
export interface EstimateDomainTask {
  id: string;
  lineType: EstimateLineItemType;
  title: string;
  description?: string;
  scopeName?: string;
  trade?: string;
  activity?: string;
  position: number;
  lineItem: EstimateLineItemInput;
  overheadPercent: number;
  profitPercent: number;
  contingencyPercent: number;
  taxPercent: number;
  wastePercent: number;
  scheduleEnabled: boolean;
  weatherSensitive: boolean;
  inspectionRequired: boolean;
  calculatedValues: Record<string, unknown>;
  equipmentRate?: number;
  equipmentRateType?: EquipmentRateType;
  equipmentUsageUnits?: number;
}

/** Domain-facing version with line items sorted by position. */
export interface EstimateDomainVersion {
  id: string;
  estimateId: string;
  projectId: string;
  versionNumber: number;
  versionName: string;
  estimateType: EstimateType;
  status: EstimateStatus;
  snapshot: Partial<EstimateSnapshot>;
  totals: EstimateCostTotals;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  lineItems: EstimateDomainTask[];
  warnings: string[];
}

export interface MapDomainTaskToLineItemInsertParams {
  task: EstimateDomainTask;
  estimateVersionId: string;
  projectId: string;
  parentLineItemId?: string | null;
}

export interface MapCalculatedTaskToLineItemInsertParams {
  task: EstimateDomainTask;
  estimateVersionId: string;
  projectId: string;
  calculatedValues: Record<string, unknown>;
  parentLineItemId?: string | null;
}

export interface MapEstimateSnapshotToVersionInsertParams {
  snapshot: EstimateSnapshot;
  estimateId: string;
  projectId: string;
  versionNumber: number;
  versionName: string;
  createdBy?: string | null;
  notes?: string | null;
}

export const ESTIMATE_QUANTITY_FORMULAS: readonly EstimateQuantityFormula[] = [
  'area',
  'wall_area',
  'net_wall_area',
  'volume_cubic_feet',
  'concrete_cubic_yards',
  'quantity_with_waste',
  'material_coverage_units',
];

export const PRODUCTION_RATE_TYPES: readonly ProductionRateType[] = [
  'units_per_labor_hour',
  'units_per_labor_day',
  'labor_hours_per_unit',
  'units_per_crew_day',
];
