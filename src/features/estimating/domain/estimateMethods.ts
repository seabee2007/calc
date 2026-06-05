import type { EstimateType } from './estimateTypes';

export type EstimateDetailLevel = 'high_level' | 'division_scope' | 'task_level' | 'bid_ready';

export interface EstimateMethodDefinition {
  id: EstimateType;
  label: string;
  shortDescription: string;
  intendedUse: string;
  detailLevel: EstimateDetailLevel;
  schedulePreviewRecommended: boolean;
  proposalGenerationRecommended: boolean;
  lineItemDetailRequired: boolean;
  workflowNote: string;
}

export const ESTIMATE_TYPES: readonly EstimateType[] = [
  'quick_feasibility',
  'budget',
  'detailed',
  'bid',
] as const;

export const DEFAULT_ESTIMATE_METHOD: EstimateType = 'detailed';

export const ESTIMATE_METHODS: readonly EstimateMethodDefinition[] = [
  {
    id: 'quick_feasibility',
    label: 'Quick Feasibility',
    shortDescription: 'Fast early-stage rough order of magnitude estimate.',
    intendedUse: 'Feasibility checks and go/no-go decisions before design is complete.',
    detailLevel: 'high_level',
    schedulePreviewRecommended: false,
    proposalGenerationRecommended: false,
    lineItemDetailRequired: false,
    workflowNote: 'Fast rough number for early planning.',
  },
  {
    id: 'budget',
    label: 'Budget Estimate',
    shortDescription: 'Rough project budget by division or scope.',
    intendedUse: 'Owner budgets, internal planning, and ROM pricing before detailed takeoff.',
    detailLevel: 'division_scope',
    schedulePreviewRecommended: false,
    proposalGenerationRecommended: false,
    lineItemDetailRequired: false,
    workflowNote: 'Rough budget by division or scope.',
  },
  {
    id: 'detailed',
    label: 'Detailed Estimate',
    shortDescription:
      'Activity-based estimate with quantities, production rates, labor, materials, equipment, and schedule planning.',
    intendedUse: 'Production planning, labor rollups, and schedule-ready task detail.',
    detailLevel: 'task_level',
    schedulePreviewRecommended: true,
    proposalGenerationRecommended: false,
    lineItemDetailRequired: true,
    workflowNote: 'Activity-based estimating with schedule support.',
  },
  {
    id: 'bid',
    label: 'Bid Estimate',
    shortDescription:
      'Proposal-ready estimate with detailed scope, pricing, markup, schedule, and contract support.',
    intendedUse: 'Client proposals, bid submissions, and contract pricing packages.',
    detailLevel: 'bid_ready',
    schedulePreviewRecommended: true,
    proposalGenerationRecommended: true,
    lineItemDetailRequired: true,
    workflowNote: 'Proposal-ready scope, pricing, and contract support.',
  },
] as const;

const METHOD_BY_ID = new Map<EstimateType, EstimateMethodDefinition>(
  ESTIMATE_METHODS.map((method) => [method.id, method]),
);

export function isEstimateType(value: unknown): value is EstimateType {
  return typeof value === 'string' && ESTIMATE_TYPES.includes(value as EstimateType);
}

export function listEstimateMethods(): EstimateMethodDefinition[] {
  return [...ESTIMATE_METHODS];
}

export function getEstimateMethod(
  type: EstimateType | string | null | undefined,
): EstimateMethodDefinition {
  if (isEstimateType(type)) {
    return METHOD_BY_ID.get(type) ?? METHOD_BY_ID.get(DEFAULT_ESTIMATE_METHOD)!;
  }
  return METHOD_BY_ID.get(DEFAULT_ESTIMATE_METHOD)!;
}

export function normalizeEstimateMethod(
  type: EstimateType | string | null | undefined,
): EstimateType {
  return getEstimateMethod(type).id;
}
