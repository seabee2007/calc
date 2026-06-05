export const UNASSIGNED_DIVISION_KEY = '__unassigned_division__';
export const GENERAL_SCOPE_KEY = '__general_scope__';

export const UNASSIGNED_DIVISION_LABEL = 'Unassigned Division';
export const GENERAL_SCOPE_LABEL = 'General Scope';

/** Rollup totals for a division, scope, or filtered view (task rows only). */
export interface EstimateGroupRollup {
  itemCount: number;
  laborHours: number;
  manDays: number;
  crewDays: number;
  durationDays: number;
  directCost: number;
  materialCost: number;
  equipmentCost: number;
  subcontractorCost: number;
  indirectCost: number;
  sellPrice: number;
  scheduleEnabledCount: number;
  weatherSensitiveCount: number;
  inspectionRequiredCount: number;
}

export interface EstimateGroupedScope<TItem> {
  key: string;
  label: string;
  divisionKey: string;
  items: TItem[];
  /** Minimum task position in this scope (for stable ordering). */
  minPosition: number;
  rollup: EstimateGroupRollup;
}

export interface EstimateGroupedDivision<TItem> {
  key: string;
  label: string;
  scopes: EstimateGroupedScope<TItem>[];
  rollup: EstimateGroupRollup;
}

export interface EstimateLineItemsFilter {
  divisionKey: string | null;
  scopeKey: string | null;
}

export function emptyGroupRollup(): EstimateGroupRollup {
  return {
    itemCount: 0,
    laborHours: 0,
    manDays: 0,
    crewDays: 0,
    durationDays: 0,
    directCost: 0,
    materialCost: 0,
    equipmentCost: 0,
    subcontractorCost: 0,
    indirectCost: 0,
    sellPrice: 0,
    scheduleEnabledCount: 0,
    weatherSensitiveCount: 0,
    inspectionRequiredCount: 0,
  };
}
