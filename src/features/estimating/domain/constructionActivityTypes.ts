/**
 * NTRP-style estimating domain types.
 *
 * Hierarchy:
 *   EstimateDivision (CSI / master activity)
 *     → ConstructionActivity (schedulable work package)
 *       → ActivityLineItem (detailed estimating element; not a schedule activity)
 */

/** CSI / NTRP division such as 03 Concrete. */
export interface EstimateDivision {
  id: string;
  code: string;
  name: string;
  description?: string;
}

/**
 * Reusable production-rate library record sourced from
 * NTRP 4-04.2.3/TM 3-34.41/MCRP 3-40D.12, Construction Estimating.
 *
 * ID format: {divCode}-{masterFormatSection}-{lineNumber}
 * Example:   "03-15-05.96-0220"  (Division 03, MF 03 15 05.96, line 0220)
 */
export interface ProductionRate {
  /** Source-based ID: "{divCode}-{mfSection}-{lineNumber}" */
  id: string;

  divisionCode: string;
  divisionName: string;

  /** CSI MasterFormat section, e.g. "03 15 05.96" */
  masterFormatCode: string;
  /** Line number within the figure, e.g. "0220" */
  workElementLineNumber: string;

  description: string;
  unit: string;

  rateType: 'labor_production' | 'equipment_production' | 'weight_measure' | 'material_quantity';

  /** Required when rateType = "labor_production" */
  manHoursPerUnit?: number;
  /** Required when rateType = "equipment_production" */
  equipmentHoursPerUnit?: number;
  /** Required when rateType = "weight_measure" | "material_quantity" */
  quantityPerUnit?: number;

  minimumCrewSize?: number;
  crewComposition?: {
    builder?: number;
    electrician?: number;
    equipmentOperator?: number;
    steelworker?: number;
    utilitiesman?: number;
    laborer?: number;
    welder?: number;
  };

  sourceManual: string;
  sourceEdition: string;
  sourceDivision: string;
  sourceFigure: string;
  sourcePage: string;
  sourcePdfPage?: number;
  sourceNotes?: string[];

  /** Always true for Chapter 5 labor figures. */
  directLaborOnly: boolean;
  militaryAdjusted: boolean;
  civilianConversionMultiplier?: number;

  tags: string[];
  applicableActivityTypes: string[];

  /** References production_rate_import_batches.id */
  importBatchId: string;
  reviewedBy?: string;
  reviewedAt?: string;
  isActive: boolean;
  supersededById?: string;
}

/** Template for a schedulable construction activity under a division. */
export interface ConstructionActivityTemplate {
  id: string;
  divisionId: string;
  code: string;
  name: string;
  description?: string;
  /** When true, this activity may appear on Logic Network / CPM / Level III Gantt. */
  scheduleEnabled: boolean;
  defaultCrewSize?: number;
  defaultHoursPerDay?: number;
  defaultProductionFactor?: number;
}

/** Template for a detailed estimating line inside a construction activity. */
export interface ActivityLineItemTemplate {
  id: string;
  constructionActivityTemplateId: string;
  name: string;
  unit: string;
  /** Optional link to a reusable production-rate record. */
  productionRateId?: string;
  /** Default man-hours per unit when no production rate is linked. */
  defaultManHoursPerUnit?: number;
  sortOrder?: number;
}

/** Project-scoped construction activity instance. */
export interface ProjectConstructionActivity {
  id: string;
  projectId: string;
  estimateId?: string;
  /** DB column: activity_template_id */
  activityTemplateId?: string;
  /** @deprecated use activityTemplateId */
  templateId?: string;
  divisionCode: string;
  divisionName: string;
  /** DB column: activity_code */
  activityCode: string;
  /** @deprecated use activityCode */
  code?: string;
  /** DB column: title */
  title: string;
  /** @deprecated use title */
  name?: string;
  description?: string;
  scheduleEnabled: boolean;
  crewSize: number;
  hoursPerDay: number;
  productionFactor: number;
  calculatedManHours?: number;
  calculatedManDays?: number;
  calculatedDurationDays?: number;
  /** User-set override for scheduled duration (days). */
  durationDaysOverride?: number | null;
  effectiveDurationDays?: number;
  totalLaborCost?: number;
  totalMaterialCost?: number;
  totalEquipmentCost?: number;
  totalSubcontractCost?: number;
  totalCost?: number;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Project-scoped activity line item — never a schedule activity. */
export interface ProjectActivityLineItem {
  id: string;
  /** DB column: project_activity_id */
  projectActivityId: string;
  /** @deprecated use projectActivityId */
  constructionActivityId?: string;
  projectId: string;
  productionRateId: string;
  /** @deprecated use productionRateId */
  templateId?: string;
  name: string;
  description?: string;
  unit: string;
  quantity: number;
  manHoursPerUnit: number;
  productionFactor: number;
  calculatedManHours: number;
  laborCost: number;
  materialCost: number;
  equipmentCost: number;
  subcontractCost?: number;
  totalCost?: number;
  sortOrder?: number;
  createdAt?: string;
}

/** Rolled-up labor, cost, and duration for a construction activity. */
export interface ActivityRollupResult {
  totalManHours: number;
  totalManDays: number;
  calculatedDurationDays: number;
  /** Effective duration after optional override (same as durationDays). */
  effectiveDurationDays: number;
  /** Effective duration after optional override. */
  durationDays: number;
  totalLaborCost: number;
  totalMaterialCost: number;
  totalEquipmentCost: number;
  totalDirectCost: number;
  lineItemCount: number;
  warnings: string[];
}
