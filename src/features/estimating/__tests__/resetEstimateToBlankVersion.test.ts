import { describe, expect, it, vi } from 'vitest';
import {
  BLANK_ESTIMATE_TOTALS,
  resetEstimateToBlankVersion,
} from '../application/resetEstimateToBlankVersion';
import type {
  EstimateSummary,
  EstimateVersionRow,
  RepositoryResult,
} from '../infrastructure/estimateDbTypes';

function success<T>(data: T): RepositoryResult<T> {
  return { data, error: null };
}

function versionRow(versionNumber: number, id = `ver-${versionNumber}`): EstimateVersionRow {
  return {
    id,
    estimate_id: 'est-1',
    project_id: 'proj-1',
    version_number: versionNumber,
    version_name: `Draft v${versionNumber}`,
    estimate_type: 'detailed',
    status: 'draft',
    snapshot: {},
    totals: {},
    notes: null,
    created_by: 'user-1',
    created_at: '2026-06-06T00:00:00.000Z',
  };
}

describe('resetEstimateToBlankVersion', () => {
  it('creates a fresh blank version and updates current_version_id', async () => {
    const listEstimateVersions = vi.fn(async () => success([versionRow(1), versionRow(2)]));
    const createEstimateVersion = vi.fn(async () => success(versionRow(3, 'ver-reset')));
    const updateEstimateCurrentVersion = vi.fn(async () =>
      success({ id: 'est-1', currentVersionId: 'ver-reset' } as EstimateSummary),
    );
    const insertEstimateLineItems = vi.fn();

    const result = await resetEstimateToBlankVersion(
      {
        estimateId: 'est-1',
        projectId: 'proj-1',
        estimateType: 'detailed',
        createdBy: 'user-1',
      },
      {
        listEstimateVersions,
        createEstimateVersion,
        updateEstimateCurrentVersion,
      },
    );

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ versionId: 'ver-reset', versionNumber: 3 });
    expect(createEstimateVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        estimateId: 'est-1',
        projectId: 'proj-1',
        versionNumber: 3,
        versionName: 'Reset Draft v3',
        estimateType: 'detailed',
        status: 'draft',
        totals: BLANK_ESTIMATE_TOTALS,
      }),
    );

    const createArg = createEstimateVersion.mock.calls[0][0];
    expect(createArg.snapshot).toEqual(
      expect.objectContaining({
        lineItems: [],
        totals: BLANK_ESTIMATE_TOTALS,
      }),
    );
    expect(updateEstimateCurrentVersion).toHaveBeenCalledWith({
      estimateId: 'est-1',
      versionId: 'ver-reset',
    });
    expect(insertEstimateLineItems).not.toHaveBeenCalled();
  });
});
