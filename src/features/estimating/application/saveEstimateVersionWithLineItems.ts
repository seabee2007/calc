import { buildEstimateDraftSnapshot } from './buildEstimateDraftSnapshot';
import type { EstimateDraftLine } from './estimateDraftLine';
import { sortDraftLinesByPosition } from './estimateDraftLine';
import type {
  EstimateDomainVersion,
  EstimateLineItemRow,
  EstimateSummary,
  EstimateVersionRow,
  RepositoryResult,
} from '../infrastructure/estimateDbTypes';
import {
  mapDraftLineToLineItemInsert,
  mapEstimateSnapshotToVersionInsert,
} from '../infrastructure/estimateMappers';
import {
  createEstimateVersion,
  insertEstimateLineItems,
  listEstimateVersions,
  updateEstimateCurrentVersion,
  type CreateEstimateVersionParams,
  type InsertEstimateLineItemsParams,
  type UpdateEstimateCurrentVersionParams,
} from '../infrastructure/estimateRepository';

export interface SaveEstimateVersionWithLineItemsParams {
  estimateId: string;
  projectId: string;
  currentVersion: Pick<EstimateDomainVersion, 'estimateType' | 'status' | 'snapshot'>;
  draftLines: EstimateDraftLine[];
  createdBy?: string | null;
}

export interface SaveEstimateVersionWithLineItemsResult {
  versionId: string;
  versionNumber: number;
  lineItemCount: number;
}

export interface SaveEstimateVersionWithLineItemsDeps {
  listEstimateVersions: (
    estimateId: string,
  ) => Promise<RepositoryResult<EstimateVersionRow[]>>;
  createEstimateVersion: (
    params: CreateEstimateVersionParams,
  ) => Promise<RepositoryResult<EstimateVersionRow>>;
  insertEstimateLineItems: (
    params: InsertEstimateLineItemsParams,
  ) => Promise<RepositoryResult<EstimateLineItemRow[]>>;
  updateEstimateCurrentVersion: (
    params: UpdateEstimateCurrentVersionParams,
  ) => Promise<RepositoryResult<EstimateSummary>>;
}

const defaultDeps: SaveEstimateVersionWithLineItemsDeps = {
  listEstimateVersions,
  createEstimateVersion,
  insertEstimateLineItems,
  updateEstimateCurrentVersion,
};

function failure(error: string): RepositoryResult<SaveEstimateVersionWithLineItemsResult> {
  return { data: null, error };
}

export function computeNextVersionNumber(versions: EstimateVersionRow[]): number {
  if (versions.length === 0) return 1;
  const max = Math.max(...versions.map((row) => row.version_number));
  return max + 1;
}

function findCalculatedLineForDraft(
  draftLine: EstimateDraftLine,
  snapshotLineItems: ReturnType<typeof buildEstimateDraftSnapshot>['lineItems'],
  index: number,
) {
  const lineId = draftLine.task.lineItem.id || draftLine.task.id;
  return (
    snapshotLineItems.find((line) => line.id === lineId) ?? snapshotLineItems[index] ?? null
  );
}

export async function saveEstimateVersionWithLineItems(
  params: SaveEstimateVersionWithLineItemsParams,
  deps: SaveEstimateVersionWithLineItemsDeps = defaultDeps,
): Promise<RepositoryResult<SaveEstimateVersionWithLineItemsResult>> {
  if (params.draftLines.length === 0) {
    return failure('At least one draft line item is required to save.');
  }

  const versionsResult = await deps.listEstimateVersions(params.estimateId);
  if (versionsResult.error || !versionsResult.data) {
    return failure(versionsResult.error ?? 'Failed to list estimate versions.');
  }

  const nextVersionNumber = computeNextVersionNumber(versionsResult.data);
  const versionName = `Draft v${nextVersionNumber}`;
  const sortedDraftLines = sortDraftLinesByPosition(params.draftLines);

  const snapshot = buildEstimateDraftSnapshot({
    estimateId: params.estimateId,
    projectId: params.projectId,
    versionNumber: nextVersionNumber,
    estimateType: params.currentVersion.estimateType ?? 'detailed',
    status: 'draft',
    draftLines: sortedDraftLines,
    pricing: params.currentVersion.snapshot?.pricing,
  });

  const versionPayload = mapEstimateSnapshotToVersionInsert({
    snapshot: {
      ...snapshot,
      meta: {
        ...snapshot.meta,
        status: 'draft',
        version: nextVersionNumber,
      },
    },
    estimateId: params.estimateId,
    projectId: params.projectId,
    versionNumber: nextVersionNumber,
    versionName,
    createdBy: params.createdBy ?? null,
  });

  const versionResult = await deps.createEstimateVersion({
    estimateId: params.estimateId,
    projectId: params.projectId,
    versionNumber: nextVersionNumber,
    versionName,
    estimateType: params.currentVersion.estimateType ?? snapshot.meta.estimateType ?? 'detailed',
    status: 'draft',
    snapshot: versionPayload.snapshot ?? {},
    totals: versionPayload.totals ?? {},
    createdBy: params.createdBy ?? null,
  });

  if (versionResult.error || !versionResult.data) {
    return failure(versionResult.error ?? 'Failed to create estimate version.');
  }

  const newVersion = versionResult.data;

  const lineItemInserts = sortedDraftLines.flatMap((draftLine, index) => {
    const calculatedLine = findCalculatedLineForDraft(draftLine, snapshot.lineItems, index);
    if (!calculatedLine) return [];

    return [
      mapDraftLineToLineItemInsert({
        task: { ...draftLine.task, position: index, lineType: 'task' },
        unit: draftLine.unit,
        indirectCost: draftLine.indirectCost,
        calculatedLine,
        estimateVersionId: newVersion.id,
        projectId: params.projectId,
        position: index,
      }),
    ];
  });

  if (lineItemInserts.length === 0) {
    return failure('Failed to map draft line items for insert.');
  }

  const insertResult = await deps.insertEstimateLineItems({ lineItems: lineItemInserts });
  if (insertResult.error || !insertResult.data) {
    return failure(insertResult.error ?? 'Failed to insert estimate line items.');
  }

  const linkResult = await deps.updateEstimateCurrentVersion({
    estimateId: params.estimateId,
    versionId: newVersion.id,
  });

  if (linkResult.error || !linkResult.data) {
    return failure(linkResult.error ?? 'Failed to update current estimate version.');
  }

  return {
    data: {
      versionId: newVersion.id,
      versionNumber: nextVersionNumber,
      lineItemCount: insertResult.data.length,
    },
    error: null,
  };
}
