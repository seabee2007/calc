import type { EstimateSummary, EstimateVersionRow, RepositoryResult } from '../infrastructure/estimateDbTypes';
import {
  createEstimate,
  createEstimateVersion,
  updateEstimateCurrentVersion,
} from '../infrastructure/estimateRepository';
import { EMPTY_ESTIMATE_SNAPSHOT_JSON, EMPTY_ESTIMATE_TOTALS_JSON } from '../ui/estimateFormatters';

export interface CreateDraftEstimateParams {
  projectId: string;
  createdBy?: string | null;
}

export interface CreateDraftEstimateResult {
  estimate: EstimateSummary;
  version: EstimateVersionRow;
}

export interface CreateDraftEstimateDeps {
  createEstimate: typeof createEstimate;
  createEstimateVersion: typeof createEstimateVersion;
  updateEstimateCurrentVersion: typeof updateEstimateCurrentVersion;
}

const defaultDeps: CreateDraftEstimateDeps = {
  createEstimate,
  createEstimateVersion,
  updateEstimateCurrentVersion,
};

function failure(error: string): RepositoryResult<CreateDraftEstimateResult> {
  return { data: null, error };
}

export async function createDraftEstimate(
  params: CreateDraftEstimateParams,
  deps: CreateDraftEstimateDeps = defaultDeps,
): Promise<RepositoryResult<CreateDraftEstimateResult>> {
  const estimateResult = await deps.createEstimate({
    projectId: params.projectId,
    name: 'Project Estimate',
    status: 'draft',
    createdBy: params.createdBy ?? null,
  });

  if (estimateResult.error || !estimateResult.data) {
    return failure(estimateResult.error ?? 'Failed to create estimate.');
  }

  const estimate = estimateResult.data;

  const versionResult = await deps.createEstimateVersion({
    estimateId: estimate.id,
    projectId: params.projectId,
    versionNumber: 1,
    versionName: 'Initial Draft',
    estimateType: 'detailed',
    status: 'draft',
    snapshot: EMPTY_ESTIMATE_SNAPSHOT_JSON,
    totals: EMPTY_ESTIMATE_TOTALS_JSON,
    createdBy: params.createdBy ?? null,
  });

  if (versionResult.error || !versionResult.data) {
    return failure(versionResult.error ?? 'Failed to create estimate version.');
  }

  const version = versionResult.data;

  const linkResult = await deps.updateEstimateCurrentVersion({
    estimateId: estimate.id,
    versionId: version.id,
  });

  if (linkResult.error || !linkResult.data) {
    return failure(linkResult.error ?? 'Failed to set current estimate version.');
  }

  return {
    data: {
      estimate: linkResult.data,
      version,
    },
    error: null,
  };
}
