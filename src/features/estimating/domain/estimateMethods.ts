import type { EstimateType, LegacyEstimateType, StoredEstimateType } from './estimateTypes';

export type EstimateDetailLevel =
  | 'high_level'
  | 'division_scope'
  | 'task_level'
  | 'bid_ready'
  | 'change_order'
  | 'unit_price'
  | 'labor_production'
  | 'vendor_quote';

export interface EstimateMethodDefinition {
  id: EstimateType;
  label: string;
  shortDescription: string;
  intendedUse: string;
  primaryWorkflow: string;
  detailLevel: EstimateDetailLevel;
  defaultSchedulingEnabled: boolean;
  schedulingOptional: boolean;
  schedulePreviewRecommended: boolean;
  proposalGenerationRecommended: boolean;
  lineItemDetailRequired: boolean;
  workflowNote: string;
}

export const ESTIMATE_TYPES: readonly EstimateType[] = [
  'quick',
  'conceptual',
  'detailed',
  'bid',
  'change_order',
  'unit_price',
  'self_perform_labor',
  'subcontractor_quote',
] as const;

export const LEGACY_ESTIMATE_TYPES: readonly LegacyEstimateType[] = [
  'quick_feasibility',
  'budget',
] as const;

const LEGACY_TO_CANONICAL: Record<LegacyEstimateType, EstimateType> = {
  quick_feasibility: 'quick',
  budget: 'conceptual',
};

export const DEFAULT_ESTIMATE_METHOD: EstimateType = 'detailed';

export const ESTIMATE_METHODS: readonly EstimateMethodDefinition[] = [
  {
    id: 'quick',
    label: 'Quick Estimate',
    shortDescription:
      'Fast rough pricing using square-foot, unit, or allowance pricing.',
    intendedUse: 'Early rough pricing before design is complete.',
    primaryWorkflow: 'Project size, unit pricing, and high-level assumptions.',
    detailLevel: 'high_level',
    defaultSchedulingEnabled: false,
    schedulingOptional: true,
    schedulePreviewRecommended: false,
    proposalGenerationRecommended: false,
    lineItemDetailRequired: false,
    workflowNote: 'Fast rough number for early planning.',
  },
  {
    id: 'conceptual',
    label: 'Conceptual Estimate',
    shortDescription:
      'Early budget estimate using assumptions, allowances, and rough quantities.',
    intendedUse: 'Budgeting before drawings are complete.',
    primaryWorkflow: 'Conceptual budget, assumptions, and allowances.',
    detailLevel: 'division_scope',
    defaultSchedulingEnabled: false,
    schedulingOptional: true,
    schedulePreviewRecommended: false,
    proposalGenerationRecommended: false,
    lineItemDetailRequired: false,
    workflowNote: 'Early budget with assumptions and allowances.',
  },
  {
    id: 'detailed',
    label: 'Detailed Estimate',
    shortDescription:
      'Activity and work-element based estimating using production rates and labor rates.',
    intendedUse: 'Production planning, labor rollups, and schedule-ready detail.',
    primaryWorkflow:
      'Construction activities, work elements, production rates, labor rates, and schedule.',
    detailLevel: 'task_level',
    defaultSchedulingEnabled: true,
    schedulingOptional: false,
    schedulePreviewRecommended: true,
    proposalGenerationRecommended: false,
    lineItemDetailRequired: true,
    workflowNote: 'Activity-based estimating with schedule support.',
  },
  {
    id: 'bid',
    label: 'Bid Estimate',
    shortDescription:
      'Full contractor bid with activity pricing, markup, exclusions, alternates, and proposal output.',
    intendedUse: 'Client proposals, bid submissions, and contract pricing.',
    primaryWorkflow:
      'Activities, pricing, markup, alternates, exclusions, and proposal export.',
    detailLevel: 'bid_ready',
    defaultSchedulingEnabled: true,
    schedulingOptional: false,
    schedulePreviewRecommended: true,
    proposalGenerationRecommended: true,
    lineItemDetailRequired: true,
    workflowNote: 'Proposal-ready scope, pricing, and contract support.',
  },
  {
    id: 'change_order',
    label: 'Change Order Estimate',
    shortDescription:
      'Estimate added, deleted, or revised scope against an existing project.',
    intendedUse: 'Pricing change orders during construction.',
    primaryWorkflow: 'Change order scope, pricing deltas, and markup.',
    detailLevel: 'change_order',
    defaultSchedulingEnabled: false,
    schedulingOptional: true,
    schedulePreviewRecommended: false,
    proposalGenerationRecommended: false,
    lineItemDetailRequired: true,
    workflowNote: 'Added, deleted, or revised scope against existing work.',
  },
  {
    id: 'unit_price',
    label: 'Unit Price Estimate',
    shortDescription: 'Estimate repetitive work by LF, SF, CY, EA, TON, etc.',
    intendedUse: 'Repetitive scopes priced by unit of measure.',
    primaryWorkflow: 'Unit price items and quantity extensions.',
    detailLevel: 'unit_price',
    defaultSchedulingEnabled: false,
    schedulingOptional: true,
    schedulePreviewRecommended: false,
    proposalGenerationRecommended: false,
    lineItemDetailRequired: true,
    workflowNote: 'Price repetitive work by unit of measure.',
  },
  {
    id: 'self_perform_labor',
    label: 'Self-Perform Labor Estimate',
    shortDescription:
      'Labor production, crew planning, man-hours, crew-days, and duration planning.',
    intendedUse: 'Self-perform labor planning and crew scheduling.',
    primaryWorkflow: 'Labor production, crews, man-hours, and durations.',
    detailLevel: 'labor_production',
    defaultSchedulingEnabled: true,
    schedulingOptional: false,
    schedulePreviewRecommended: true,
    proposalGenerationRecommended: false,
    lineItemDetailRequired: true,
    workflowNote: 'Labor production and crew duration planning.',
  },
  {
    id: 'subcontractor_quote',
    label: 'Subcontractor / Vendor Quote Estimate',
    shortDescription:
      'Track quoted scope, inclusions, exclusions, alternates, and quote comparison.',
    intendedUse: 'Subcontractor and vendor quote tracking and comparison.',
    primaryWorkflow: 'Quoted scope, exclusions, alternates, and comparisons.',
    detailLevel: 'vendor_quote',
    defaultSchedulingEnabled: false,
    schedulingOptional: false,
    schedulePreviewRecommended: false,
    proposalGenerationRecommended: false,
    lineItemDetailRequired: false,
    workflowNote: 'Track and compare subcontractor or vendor quotes.',
  },
] as const;

const METHOD_BY_ID = new Map<EstimateType, EstimateMethodDefinition>(
  ESTIMATE_METHODS.map((method) => [method.id, method]),
);

export function isLegacyEstimateType(value: unknown): value is LegacyEstimateType {
  return typeof value === 'string' && LEGACY_ESTIMATE_TYPES.includes(value as LegacyEstimateType);
}

export function isEstimateType(value: unknown): value is EstimateType {
  return typeof value === 'string' && ESTIMATE_TYPES.includes(value as EstimateType);
}

export function isStoredEstimateType(value: unknown): value is StoredEstimateType {
  return isEstimateType(value) || isLegacyEstimateType(value);
}

export function listEstimateMethods(): EstimateMethodDefinition[] {
  return [...ESTIMATE_METHODS];
}

export function getEstimateMethod(
  type: StoredEstimateType | string | null | undefined,
): EstimateMethodDefinition {
  const normalized = normalizeEstimateMethod(type);
  return METHOD_BY_ID.get(normalized) ?? METHOD_BY_ID.get(DEFAULT_ESTIMATE_METHOD)!;
}

export function normalizeEstimateMethod(
  type: StoredEstimateType | string | null | undefined,
): EstimateType {
  if (isLegacyEstimateType(type)) {
    return LEGACY_TO_CANONICAL[type];
  }
  if (isEstimateType(type)) {
    return type;
  }
  return DEFAULT_ESTIMATE_METHOD;
}

export function getDefaultSchedulingEnabled(
  type: StoredEstimateType | string | null | undefined,
): boolean {
  return getEstimateMethod(type).defaultSchedulingEnabled;
}

export function resolveSchedulingEnabled(
  type: StoredEstimateType | string | null | undefined,
  stored: boolean | null | undefined,
): boolean {
  if (stored != null) return stored;
  return getDefaultSchedulingEnabled(type);
}

export function getEstimateTypeLabel(type: StoredEstimateType | string | null | undefined): string {
  return getEstimateMethod(type).label;
}

export function supportsConstructionActivitiesWorkflow(
  type: StoredEstimateType | string | null | undefined,
): boolean {
  const normalized = normalizeEstimateMethod(type);
  return (
    normalized === 'detailed' ||
    normalized === 'bid' ||
    normalized === 'self_perform_labor'
  );
}

export function isQuickEstimateType(type: StoredEstimateType | string | null | undefined): boolean {
  return normalizeEstimateMethod(type) === 'quick';
}

export function isConceptualEstimateType(
  type: StoredEstimateType | string | null | undefined,
): boolean {
  return normalizeEstimateMethod(type) === 'conceptual';
}
