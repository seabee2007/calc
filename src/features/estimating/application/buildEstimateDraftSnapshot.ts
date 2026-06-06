import { buildEstimateSnapshot } from './buildEstimateSnapshot';
import {
  draftLineToLineItemInput,
  sortDraftLinesByPosition,
  type EstimateDraftLine,
} from './estimateDraftLine';
import { normalizeEstimatePricingInput } from '../domain/estimateSnapshot';
import type {
  EstimatePricingInput,
  EstimateSelectedDivision,
  EstimateSnapshot,
  EstimateStatus,
  EstimateType,
} from '../domain/estimateTypes';

export interface BuildEstimateDraftSnapshotParams {
  estimateId: string;
  projectId: string;
  versionNumber: number;
  estimateType?: EstimateType;
  status?: EstimateStatus;
  draftLines: EstimateDraftLine[];
  selectedDivisions?: EstimateSelectedDivision[];
  pricing?: EstimatePricingInput;
  currencyCode?: string;
}

export function buildEstimateDraftSnapshot(
  params: BuildEstimateDraftSnapshotParams,
): EstimateSnapshot {
  const sortedLines = sortDraftLinesByPosition(params.draftLines);
  const lineItems = sortedLines.map(draftLineToLineItemInput);
  const pricing = normalizeEstimatePricingInput(params.pricing);

  return buildEstimateSnapshot({
    meta: {
      estimateId: params.estimateId,
      projectId: params.projectId,
      version: params.versionNumber,
      estimateType: params.estimateType ?? 'detailed',
      status: params.status ?? 'draft',
      currencyCode: params.currencyCode ?? 'USD',
      preparedAtIso: new Date().toISOString(),
    },
    pricing,
    lineItems,
    selectedDivisions: params.selectedDivisions,
  });
}
