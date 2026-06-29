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
  /**
   * DB column: activity_template_id
   * FK to construction_activity_templates(id).
   * NULL / undefined when created from the local TypeScript registry.
   * Only populated when created from a real seeded DB template row.
   */
  activityTemplateId?: string | null;
  /**
   * DB column: source_template_key
   * Local registry key (e.g. "slab-on-grade") when activity_template_id is null.
   */
  sourceTemplateKey?: string | null;
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
  /** Template/base title before instance suffix. */
  baseTitle?: string | null;
  /** User label for repeated instances (F-1, Area C-2). */
  instanceLabel?: string | null;
  location?: string | null;
  drawingReference?: string | null;
  phase?: string | null;
  notes?: string | null;
  /** DD-AA segment of activity_code. */
  activitySequence?: number | null;
  /** Instance segment (II) within template group. */
  instanceSequence?: number | null;
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
  /**
   * FK to production_rates(id).
   * NULL when the line item uses a local/generated rate not seeded in DB.
   */
  productionRateId?: string | null;
  /**
   * Local/generated production rate key snapshot (e.g. "03-11-13.65-0040").
   */
  sourceProductionRateKey?: string | null;
  /** Human-readable rate description at time of estimate. */
  sourceProductionRateLabel?: string | null;
  sourceFigure?: string | null;
  sourcePage?: string | null;
  sourcePdfPage?: number | null;
  /** Source manual / document code at time of estimate. */
  sourceDocumentCode?: string | null;
  /** @deprecated use productionRateId or sourceProductionRateKey */
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
  /** FK to project_labor_rates(id) at time of pricing snapshot. */
  laborRoleId?: string | null;
  laborRoleKey?: string | null;
  laborRoleName?: string | null;
  tradeCategory?: string | null;
  hourlyRateSnapshot: number;
  burdenPercentSnapshot: number;
  fullyBurdenedRateSnapshot: number;
  billingRateSnapshot: number;
  pricingSource?: 'project_rate' | 'manual' | 'unset';
  pricingSnapshotAt?: string | null;
  productionRateAssignmentStatus?:
    | 'unassigned'
    | 'auto_matched'
    | 'verified_rate'
    | 'manual_override'
    | 'review_required'
    | 'excluded'
    | null;
  productionRateMatchConfidence?: number | null;
  productionRateMatchReason?: string | null;
  manualProductionRateReason?: string | null;
  manualProductionRateSourceNote?: string | null;
  sortOrder?: number;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Activity resource types (Materials & Equipment)
// ---------------------------------------------------------------------------

/** Who supplied the resource data. 'external_api' is reserved for a future phase. */
export type ActivityResourceProvider =
  | 'manual'
  | 'company_library'
  | 'arden_starter';

/** Immutable snapshot of the source item at the time the resource was added. */
export interface ActivityResourceSnapshot {
  /** Human-readable source description (e.g. "Arden Starter Library"). */
  sourceName: string;
  /** Original item name from the source. */
  originalName: string;
  /** Original unit from the source. */
  originalUnit: string;
  /** Default unit cost in the source (may be 0 for placeholder items). */
  originalDefaultUnitCost: number;
  /** Category from the source. */
  category?: string;
  /** Subcategory from the source. */
  subcategory?: string;
  /** CSI division from the source. */
  csiDivision?: string;
  /** CSI section from the source. */
  csiSection?: string;
  /** Source-specific notes or warnings. */
  notes?: string;
  /** ISO timestamp when the user selected this item. */
  selectedAt: string;
}

/** Shared base fields for material and equipment activity resources. */
export interface ActivityResourceBase {
  id: string;
  activityId: string;
  projectId: string;
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  sourceProvider: ActivityResourceProvider;
  sourceSnapshot?: ActivityResourceSnapshot;
  /** For starter library items: their string ID. For company library: the UUID. For manual: undefined. */
  sourceId?: string;
  /** UUID FK to company_cost_library_items — only set when sourceProvider is 'company_library'. */
  companyLibraryItemId?: string;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** A material resource attached to a construction activity. */
export type ActivityMaterialResource = ActivityResourceBase;

/** An equipment resource attached to a construction activity. */
export type ActivityEquipmentResource = ActivityResourceBase;

/** An item in a company's reusable cost library. */
export interface CompanyCostLibraryItem {
  id: string;
  userId: string;
  /** 'material' or 'equipment' */
  type: 'material' | 'equipment';
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  unit: string;
  defaultUnitCost: number;
  /** Where this item originally came from. */
  sourceProvider: ActivityResourceProvider;
  /** If promoted from a starter item, the starter item's ID. */
  sourceId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Default labor pricing snapshot fields for new line items (no rate assigned). */
export const EMPTY_LABOR_PRICING_SNAPSHOT = {
  laborRoleId: null as string | null,
  laborRoleKey: null as string | null,
  laborRoleName: null as string | null,
  tradeCategory: null as string | null,
  hourlyRateSnapshot: 0,
  burdenPercentSnapshot: 0,
  fullyBurdenedRateSnapshot: 0,
  billingRateSnapshot: 0,
  pricingSource: 'unset' as const,
  pricingSnapshotAt: null as string | null,
};

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
