import { buildEstimateSnapshot } from './buildEstimateSnapshot';
import {
  draftLineToLineItemInput,
  sortDraftLinesByPosition,
  type EstimateDraftLine,
} from './estimateDraftLine';
import {
  normalizeEstimateSettings,
  type EstimateSettings,
} from './estimateSettings';
import type {
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
  estimateSettings?: Partial<EstimateSettings> | null;
  currencyCode?: string;
}

export function buildEstimateDraftSnapshot(
  params: BuildEstimateDraftSnapshotParams,
): EstimateSnapshot {
  const sortedLines = sortDraftLinesByPosition(params.draftLines);
  const lineItems = sortedLines.map(draftLineToLineItemInput);
  const estimateSettings = normalizeEstimateSettings(params.estimateSettings);

  return buildEstimateSnapshot({
    meta: {
      estimateId: params.estimateId,
      projectId: params.projectId,
      version: params.versionNumber,
      estimateType: params.estimateType ?? 'detailed',
      status: params.status ?? 'draft',
      currencyCode: params.currencyCode ?? estimateSettings.currency,
      preparedAtIso: new Date().toISOString(),
    },
    estimateSettings,
    lineItems,
    selectedDivisions: params.selectedDivisions,
  });
}
