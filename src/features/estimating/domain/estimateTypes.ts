export type EstimateType = 'quick_feasibility' | 'budget' | 'detailed' | 'bid';

export type EstimateStatus =
  | 'draft'
  | 'review'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'superseded';

export type ProductionRateType =
  | 'units_per_labor_hour'
  | 'units_per_labor_day'
  | 'labor_hours_per_unit'
  | 'units_per_crew_day';

export type EquipmentRateType = 'hour' | 'day' | 'week' | 'month' | 'lump_sum';

export type EstimateQuantityFormula =
  | 'area'
  | 'wall_area'
  | 'net_wall_area'
  | 'volume_cubic_feet'
  | 'concrete_cubic_yards'
  | 'quantity_with_waste'
  | 'material_coverage_units';

export type EstimateWarningCode =
  | 'missing_line_description'
  | 'missing_line_quantity'
  | 'missing_quantity_formula_input'
  | 'missing_production_rate'
  | 'missing_crew_size'
  | 'missing_hours_per_day'
  | 'missing_labor_rate'
  | 'missing_material_unit_cost'
  | 'missing_equipment_rate'
  | 'missing_subcontractor_cost'
  | 'invalid_percent_clamped'
  | 'negative_cost_clamped'
  | 'non_finite_number_normalized'
  | 'empty_estimate_lines';

export interface EstimateWarning {
  code: EstimateWarningCode;
  message: string;
  lineItemId?: string;
  fieldPath?: string;
}

export interface EstimateDimensionsInput {
  length?: number;
  width?: number;
  height?: number;
}

export interface EstimateQuantityInput {
  formula?: EstimateQuantityFormula;
  quantity?: number;
  wastePercent?: number;
  dimensions?: EstimateDimensionsInput;
  openingArea?: number;
  coveragePerUnit?: number;
}

export interface EstimateLaborInput {
  productionRate?: number;
  productionRateType?: ProductionRateType;
  hoursPerDay?: number;
  crewSize?: number;
  parallelCrews?: number;
  difficultyFactor?: number;
  locationFactor?: number;
  laborRate?: number;
  burdenPercent?: number;
}

export interface EstimateMaterialInput {
  unitCost?: number;
}

export interface EstimateEquipmentInput {
  rate?: number;
  rateType?: EquipmentRateType;
  usageUnits?: number;
}

export interface EstimateSubcontractorInput {
  cost?: number;
}

export interface EstimateLineItemInput {
  id: string;
  description: string;
  csiDivision?: string;
  csiSection?: string;
  quantity: EstimateQuantityInput;
  labor?: EstimateLaborInput;
  material?: EstimateMaterialInput;
  equipment?: EstimateEquipmentInput;
  subcontractor?: EstimateSubcontractorInput;
}

export interface EstimatePricingInput {
  indirectCost?: number;
  overheadPercent?: number;
  profitPercent?: number;
  contingencyPercent?: number;
  taxPercent?: number;
}

export interface EstimateSnapshotMeta {
  estimateId: string;
  projectId: string;
  version: number;
  estimateType: EstimateType;
  status: EstimateStatus;
  currencyCode: string;
  preparedAtIso: string;
}

export type EstimateSelectedDivisionSource = 'manual' | 'ai' | 'inferred';

export interface EstimateSelectedDivision {
  code: string;
  name: string;
  source: EstimateSelectedDivisionSource;
  confidence?: number;
  reason?: string;
  createdAt: string;
}

export interface EstimateLineMetrics {
  baseQuantity: number;
  quantityWithWaste: number;
  laborHours: number;
  adjustedLaborHours: number;
  manDays: number;
  crewDays: number;
  durationDays: number;
}

export interface EstimateLineCosts {
  baseLaborCost: number;
  burdenCost: number;
  totalLaborCost: number;
  materialCost: number;
  equipmentCost: number;
  subcontractorCost: number;
  directCost: number;
}

export interface EstimateLineSnapshot {
  id: string;
  description: string;
  csiDivision?: string;
  csiSection?: string;
  quantityFormula: EstimateQuantityFormula;
  metrics: EstimateLineMetrics;
  costs: EstimateLineCosts;
}

export interface EstimateCostTotals {
  directCost: number;
  indirectCost: number;
  overhead: number;
  profit: number;
  contingency: number;
  tax: number;
  finalSellPrice: number;
}

export interface EstimateSnapshotInput {
  meta: EstimateSnapshotMeta;
  pricing?: EstimatePricingInput;
  lineItems: EstimateLineItemInput[];
  selectedDivisions?: EstimateSelectedDivision[];
}

export interface EstimateSnapshot {
  meta: EstimateSnapshotMeta;
  pricing: Required<EstimatePricingInput>;
  lineItems: EstimateLineSnapshot[];
  selectedDivisions?: EstimateSelectedDivision[];
  totals: EstimateCostTotals;
  warnings: EstimateWarning[];
}

