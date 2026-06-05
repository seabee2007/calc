import { describe, expect, it, vi } from 'vitest';
import { createDraftEstimate } from '../application/createDraftEstimate';
import type { EstimateSummary, EstimateVersionRow, RepositoryResult } from '../infrastructure/estimateDbTypes';

const estimateRow: EstimateSummary = {
  id: 'est-1',
  projectId: 'proj-1',
  name: 'Project Estimate',
  status: 'draft',
  currentVersionId: null,
  createdBy: 'user-1',
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
};

const versionRow: EstimateVersionRow = {
  id: 'ver-1',
  estimate_id: 'est-1',
  project_id: 'proj-1',
  version_number: 1,
  version_name: 'Initial Draft',
  estimate_type: 'detailed',
  status: 'draft',
  snapshot: {},
  totals: {},
  notes: null,
  created_by: 'user-1',
  created_at: '2026-06-04T00:00:00.000Z',
};

const linkedEstimate: EstimateSummary = {
  ...estimateRow,
  currentVersionId: 'ver-1',
};

function success<T>(data: T): RepositoryResult<T> {
  return { data, error: null };
}

function fail<T>(error: string): RepositoryResult<T> {
  return { data: null, error };
}

describe('createDraftEstimate', () => {
  it('creates estimate, version, and links current_version_id', async () => {
    const createEstimate = vi.fn(async () => success(estimateRow));
    const createEstimateVersion = vi.fn(async () => success(versionRow));
    const updateEstimateCurrentVersion = vi.fn(async () => success(linkedEstimate));

    const result = await createDraftEstimate(
      { projectId: 'proj-1', createdBy: 'user-1' },
      { createEstimate, createEstimateVersion, updateEstimateCurrentVersion },
    );

    expect(result.error).toBeNull();
    expect(result.data?.estimate.currentVersionId).toBe('ver-1');
    expect(result.data?.version.version_name).toBe('Initial Draft');

    expect(createEstimate).toHaveBeenCalledWith({
      projectId: 'proj-1',
      name: 'Project Estimate',
      status: 'draft',
      createdBy: 'user-1',
    });
    expect(createEstimateVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        estimateId: 'est-1',
        projectId: 'proj-1',
        versionNumber: 1,
        versionName: 'Initial Draft',
        estimateType: 'detailed',
        status: 'draft',
        snapshot: {},
        totals: {},
      }),
    );
    expect(updateEstimateCurrentVersion).toHaveBeenCalledWith({
      estimateId: 'est-1',
      versionId: 'ver-1',
    });
  });

  it('returns error when estimate insert fails', async () => {
    const result = await createDraftEstimate(
      { projectId: 'proj-1' },
      {
        createEstimate: vi.fn(async () => fail('RLS denied')),
        createEstimateVersion: vi.fn(),
        updateEstimateCurrentVersion: vi.fn(),
      },
    );

    expect(result.data).toBeNull();
    expect(result.error).toBe('RLS denied');
  });

  it('returns error when version insert fails', async () => {
    const result = await createDraftEstimate(
      { projectId: 'proj-1' },
      {
        createEstimate: vi.fn(async () => success(estimateRow)),
        createEstimateVersion: vi.fn(async () => fail('Version insert failed')),
        updateEstimateCurrentVersion: vi.fn(),
      },
    );

    expect(result.data).toBeNull();
    expect(result.error).toBe('Version insert failed');
  });

  it('returns error when linking current version fails', async () => {
    const result = await createDraftEstimate(
      { projectId: 'proj-1' },
      {
        createEstimate: vi.fn(async () => success(estimateRow)),
        createEstimateVersion: vi.fn(async () => success(versionRow)),
        updateEstimateCurrentVersion: vi.fn(async () => fail('Update failed')),
      },
    );

    expect(result.data).toBeNull();
    expect(result.error).toBe('Update failed');
  });
});
