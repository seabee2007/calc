import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentEstimate } from '../application/currentEstimateService';

const { getCurrentEstimateMock } = vi.hoisted(() => ({
  getCurrentEstimateMock: vi.fn<() => Promise<CurrentEstimate | null>>(),
}));

vi.mock('../application/currentEstimateService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../application/currentEstimateService')>();
  return {
    ...actual,
    getCurrentEstimate: getCurrentEstimateMock,
  };
});

import {
  buildOptimisticEstimateWithDivisions,
  cacheCurrentEstimateForProject,
  getCachedCurrentEstimateForProject,
  loadCurrentEstimateForProject,
  resetEstimateWorkspaceSessionCacheForTests,
} from '../ui/estimateWorkspaceLoad';
import { hasSelectedEstimateDivisions } from '../ui/estimateWorkspaceRenderRules';

function baseEstimate(overrides: Partial<CurrentEstimate> = {}): CurrentEstimate {
  return {
    id: 'estimate-1',
    projectId: 'project-1',
    estimateType: 'bid',
    status: 'draft',
    selectedDivisions: [],
    lineItems: [],
    totals: {},
    summary: {},
    assumptions: {},
    createdBy: null,
    createdAt: '2026-06-06T00:00:00.000Z',
    updatedAt: '2026-06-06T01:00:00.000Z',
    ...overrides,
  };
}

describe('estimateWorkspaceLoad', () => {
  beforeEach(() => {
    getCurrentEstimateMock.mockReset();
    resetEstimateWorkspaceSessionCacheForTests();
  });

  it('deduplicates concurrent loads for the same projectId', async () => {
    let resolveLoad: (value: CurrentEstimate | null) => void = () => {};
    const pending = new Promise<CurrentEstimate | null>((resolve) => {
      resolveLoad = resolve;
    });
    getCurrentEstimateMock.mockReturnValue(pending);

    const first = loadCurrentEstimateForProject('project-1');
    const second = loadCurrentEstimateForProject('project-1');

    expect(getCurrentEstimateMock).toHaveBeenCalledTimes(1);

    resolveLoad(baseEstimate());
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ id: 'estimate-1' }),
      expect.objectContaining({ id: 'estimate-1' }),
    ]);
    expect(getCachedCurrentEstimateForProject('project-1')).toEqual(
      expect.objectContaining({ id: 'estimate-1' }),
    );
  });

  it('keeps last loaded estimate in session cache for fast remount rendering', () => {
    expect(getCachedCurrentEstimateForProject('project-1')).toBeUndefined();
    cacheCurrentEstimateForProject('project-1', baseEstimate({ id: 'estimate-cached' }));
    expect(getCachedCurrentEstimateForProject('project-1')).toEqual(
      expect.objectContaining({ id: 'estimate-cached' }),
    );
  });

  it('distinguishes known empty estimate state from no cache', () => {
    cacheCurrentEstimateForProject('project-empty', null);
    expect(getCachedCurrentEstimateForProject('project-empty')).toBeNull();
    expect(getCachedCurrentEstimateForProject('project-missing')).toBeUndefined();
  });

  it('builds optimistic estimate with selected divisions before save resolves', () => {
    const current = baseEstimate();
    const divisions = [
      { code: '01', name: 'General Requirements', source: 'manual' as const, createdAt: '2026-06-06T00:00:00.000Z' },
      { code: '03', name: 'Concrete', source: 'manual' as const, createdAt: '2026-06-06T00:00:00.000Z' },
    ];

    const optimistic = buildOptimisticEstimateWithDivisions(current, divisions);

    expect(optimistic.selectedDivisions).toHaveLength(2);
    expect(
      hasSelectedEstimateDivisions(optimistic.selectedDivisions, []),
    ).toBe(true);
  });
});
