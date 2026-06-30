import type { ProductionRateCandidate } from '../../estimating/application/matchQuantityToProductionRates';
import type { DesignEstimatePreviewLine, DesignQuantityItem } from '../types';

export type DesignQuantityUsageDestination =
  | 'activity_line_item'
  | 'material_resource'
  | 'equipment_resource'
  | 'reference_only'
  | 'rollup'
  | 'excluded';

export type DesignQuantityUsageRole =
  | 'place_concrete_labor'
  | 'concrete_material'
  | 'formwork_labor'
  | 'strip_forms_labor'
  | 'reinforcement_labor'
  | 'reinforcement_material'
  | 'primary_labor_driver'
  | 'material_takeoff'
  | 'equipment_takeoff'
  | 'reference'
  | 'rollup'
  | 'excluded';

export type DesignQuantityUsageReviewStatus =
  | 'ready'
  | 'needs_rate'
  | 'needs_review'
  | 'material_only'
  | 'reference_only'
  | 'excluded';

export interface DesignQuantityUsage {
  id: string;
  sourcePreviewLineId: string | null;
  sourceQuantityType: string | null;
  persistedQuantityItem?: DesignQuantityItem;
  sourceLine?: DesignEstimatePreviewLine;
  enabled: boolean;
  locked: boolean;
  destination: DesignQuantityUsageDestination;
  role: DesignQuantityUsageRole;
  activityKey: string | null;
  activityTitle: string | null;
  description: string;
  quantity: number;
  unit: string;
  formula: string;
  derived: boolean;
  reviewStatus: DesignQuantityUsageReviewStatus;
  reviewReason?: string | null;
  productionRateId?: string | null;
  candidates?: ProductionRateCandidate[];
  matchConfidence?: number | null;
  matchReason?: string | null;
  manualOverride?: {
    manHoursPerUnit: number;
    reason: string;
    sourceNote: string;
  } | null;
  unitCost?: number;
  totalCost?: number;
  derivationSource?: {
    previewLineIds: string[];
    modelObjectIds: string[];
    geometryKinds: string[];
  };
  metadata: Record<string, unknown>;
}

export type DesignActivityOperation =
  | 'formwork'
  | 'place_concrete'
  | 'strip_forms'
  | 'reinforcement'
  | 'install'
  | 'reference';

export type DesignActivityDraftStatus =
  | 'ready'
  | 'needs_rate'
  | 'material_only'
  | 'reference_only'
  | 'needs_review'
  | 'excluded';

export interface DesignActivityDraft {
  key: string;
  title: string;
  divisionCode: string;
  divisionName: string;
  category: string;
  scheduleEnabled: boolean;
  sourceObjectIds: string[];
  sourcePreviewLineIds: string[];
  operation: DesignActivityOperation;
  defaultSequenceGroup: string;
  usages: DesignQuantityUsage[];
  warnings: string[];
  status: DesignActivityDraftStatus;
}

export interface DesignScopeCompileResult {
  activities: DesignActivityDraft[];
  referenceUsages: DesignQuantityUsage[];
  excludedUsages: DesignQuantityUsage[];
  rollupUsages: DesignQuantityUsage[];
  warnings: string[];
}

export type DesignQuantityDestination =
  | 'activity_line_item'
  | 'material_resource'
  | 'equipment_resource'
  | 'reference_only'
  | 'quality_check'
  | 'rollup'
  | 'placeholder'
  | 'excluded';

export type DesignScopePackageStatus =
  | 'ready'
  | 'review_required'
  | 'excluded';

export type DesignScopePackageKind =
  | 'concrete_structural'
  | 'concrete_raked_cap'
  | 'masonry_cmu_wall'
  | 'masonry_grout_reinforcement'
  | 'metals_roof_framing'
  | 'roofing_cladding_trim'
  | 'openings_doors_windows'
  | 'finishes_plaster'
  | 'reference';

export interface DesignQuantityClassification {
  previewLineId: string;
  quantityType: string;
  destination: DesignQuantityDestination;
  packageKind: DesignScopePackageKind;
  packageKey: string;
  role:
    | 'primary_labor_driver'
    | 'secondary_labor_driver'
    | 'material_takeoff'
    | 'equipment_takeoff'
    | 'reference'
    | 'rollup'
    | 'placeholder'
    | 'excluded';
  includeByDefault: boolean;
  locked: boolean;
  reason: string | null;
  preferredUnit?: string;
  keywords: readonly string[];
}

export interface DesignScopePackageQuantity {
  line: DesignEstimatePreviewLine;
  persistedQuantityItem?: DesignQuantityItem;
  classification: DesignQuantityClassification;
  candidates: ProductionRateCandidate[];
  selectedProductionRateId: string | null;
  assignmentStatus:
    | 'auto_matched'
    | 'verified_rate'
    | 'manual_override'
    | 'not_required'
    | 'review_required'
    | 'excluded';
  manualOverride?: {
    manHoursPerUnit: number;
    reason: string;
    sourceNote: string;
  } | null;
}

export interface DesignScopePackage {
  key: string;
  kind: DesignScopePackageKind;
  title: string;
  divisionCode: string;
  divisionName: string;
  category: string;
  scheduleEnabled: boolean;
  sourceObjectIds: string[];
  locationLabel: string | null;
  quantities: DesignScopePackageQuantity[];
  warnings: string[];
  status: DesignScopePackageStatus;
}
