import type { ProductionRateCandidate } from '../../estimating/application/matchQuantityToProductionRates';
import type { DesignEstimatePreviewLine, DesignQuantityItem } from '../types';

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
