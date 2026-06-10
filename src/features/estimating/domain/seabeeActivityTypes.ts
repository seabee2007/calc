/**
 * Seabee-style estimating domain types.
 *
 * Hierarchy:
 *   EstimateDivision (CSI / master activity)
 *     → ConstructionActivity (schedulable work package)
 *       → ActivityLineItem (detailed estimating element; not a schedule activity)
 */

/** CSI / Seabee division such as 03 Concrete. */
export interface EstimateDivision {
  id: string;
  code: string;
  name: string;
  description?: string;
}

/** Reusable production-rate library record (typically man-hours per unit). */
export interface ProductionRate {
  id: string;
  description: string;
  unit: string;
  /** Bare man-hours required per unit before crew size is applied. */
  manHoursPerUnit: number;
  defaultCrewSize?: number;
  trade?: string;
  sourceReference?: string;
  notes?: string;
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
  templateId?: string;
  divisionCode: string;
  divisionName: string;
  code: string;
  name: string;
  scheduleEnabled: boolean;
  crewSize: number;
  hoursPerDay: number;
  productionFactor: number;
  /** Future override for calculated duration (days). */
  durationDaysOverride?: number | null;
}

/** Project-scoped activity line item — not a schedule activity. */
export interface ProjectActivityLineItem {
  id: string;
  constructionActivityId: string;
  templateId?: string;
  name: string;
  unit: string;
  quantity: number;
  manHoursPerUnit: number;
  productionFactor: number;
  laborCost?: number;
  materialCost?: number;
  equipmentCost?: number;
  sortOrder?: number;
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
