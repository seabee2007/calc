import type {
  EstimateSummary,
  EstimateVersionRow,
  RepositoryResult,
} from '../infrastructure/estimateDbTypes';
import {
  createEstimateVersion,
  listEstimateVersions,
  updateEstimateCurrentVersion,
  type CreateEstimateVersionParams,
  type UpdateEstimateCurrentVersionParams,
} from '../infrastructure/estimateRepository';
import type { EstimateType } from '../domain/estimateTypes';
import { DEFAULT_ESTIMATE_METHOD, normalizeEstimateMethod } from '../domain/estimateMethods';
import { computeNextVersionNumber } from './saveEstimateVersionWithLineItems';

export const BLANK_ESTIMATE_TOTALS: Record<string, unknown> = {
  directCost: 0,
  indirectCost: 0,
  overhead: 0,
  profit: 0,
  contingency: 0,
  tax: 0,
  finalSellPrice: 0,
};

export interface ResetEstimateToBlankVersionParams {
  estimateId: string;
  projectId: string;
  estimateType?: EstimateType | null;
  createdBy?: string | null;
}

export interface ResetEstimateToBlankVersionResult {
  versionId: string;
  versionNumber: number;
}

export interface ResetEstimateToBlankVersionDeps {
  listEstimateVersions: (
    estimateId: string,
  ) => Promise<RepositoryResult<EstimateVersionRow[]>>;
  createEstimateVersion: (
    params: CreateEstimateVersionParams,
  ) => Promise<RepositoryResult<EstimateVersionRow>>;
  updateEstimateCurrentVersion: (
    params: UpdateEstimateCurrentVersionParams,
  ) => Promise<RepositoryResult<EstimateSummary>>;
}

const defaultDeps: ResetEstimateToBlankVersionDeps = {
  listEstimateVersions,
  createEstimateVersion,
  updateEstimateCurrentVersion,
};

function failure(error: string): RepositoryResult<ResetEstimateToBlankVersionResult> {
  return { data: null, error };
}

function buildBlankSnapshot(
  params: ResetEstimateToBlankVersionParams,
  versionNumber: number,
  estimateType: EstimateType,
): Record<string, unknown> {
  return {
    meta: {
      estimateId: params.estimateId,
      projectId: params.projectId,
      estimateType,
      status: 'draft',
      version: versionNumber,
      reset: true,
    },
    lineItems: [],
    totals: BLANK_ESTIMATE_TOTALS,
  };
}

export async function resetEstimateToBlankVersion(
  params: ResetEstimateToBlankVersionParams,
  deps: ResetEstimateToBlankVersionDeps = defaultDeps,
): Promise<RepositoryResult<ResetEstimateToBlankVersionResult>> {
  const versionsResult = await deps.listEstimateVersions(params.estimateId);
  if (versionsResult.error || !versionsResult.data) {
    return failure(versionsResult.error ?? 'Failed to list estimate versions.');
  }

  const versionNumber = computeNextVersionNumber(versionsResult.data);
  const estimateType = normalizeEstimateMethod(params.estimateType ?? DEFAULT_ESTIMATE_METHOD);
  const versionName = `Reset Draft v${versionNumber}`;

  const versionResult = await deps.createEstimateVersion({
    estimateId: params.estimateId,
    projectId: params.projectId,
    versionNumber,
    versionName,
    estimateType,
    status: 'draft',
    snapshot: buildBlankSnapshot(params, versionNumber, estimateType),
    totals: BLANK_ESTIMATE_TOTALS,
    createdBy: params.createdBy ?? null,
  });

  if (versionResult.error || !versionResult.data) {
    return failure(versionResult.error ?? 'Failed to create reset estimate version.');
  }

  const linkResult = await deps.updateEstimateCurrentVersion({
    estimateId: params.estimateId,
    versionId: versionResult.data.id,
  });

  if (linkResult.error || !linkResult.data) {
    return failure(linkResult.error ?? 'Failed to update current estimate version.');
  }

  return {
    data: {
      versionId: versionResult.data.id,
      versionNumber,
    },
    error: null,
  };
}
