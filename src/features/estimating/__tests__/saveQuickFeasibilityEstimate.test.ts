import { describe, expect, it, vi } from 'vitest';
import {
  calculateQuickFeasibilityEstimate,
  createQuickFeasibilityInputsForLocation,
  quickFeasibilityInputsFromSnapshot,
} from '../application/estimateQuickFeasibility';
import { saveQuickFeasibilityEstimate } from '../application/saveQuickFeasibilityEstimate';
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

function quickPayload() {
  const inputs = createQuickFeasibilityInputsForLocation('GU', {
    areaSF: 2_000,
    contingencyPercent: 10,
    mepIntensity: 'none',
  });
  const result = calculateQuickFeasibilityEstimate(inputs);
  return { inputs, result };
}

describe('saveQuickFeasibilityEstimate', () => {
  it('creates quick_feasibility version, saves snapshot/totals, and updates current version', async () => {
    const listEstimateVersions = vi.fn(async () => success([versionRow(1), versionRow(2)]));
    const createEstimateVersion = vi.fn(async () =>
      success({ ...versionRow(3, 'ver-new'), estimate_type: 'quick_feasibility' }),
    );
    const updateEstimateCurrentVersion = vi.fn(async () =>
      success({ id: 'est-1', currentVersionId: 'ver-new' } as EstimateSummary),
    );
    const insertEstimateLineItems = vi.fn();
    const payload = quickPayload();

    const result = await saveQuickFeasibilityEstimate(
      {
        estimateId: 'est-1',
        projectId: 'proj-1',
        inputs: payload.inputs,
        result: payload.result,
        createdBy: 'user-1',
      },
      {
        listEstimateVersions,
        createEstimateVersion,
        updateEstimateCurrentVersion,
      },
    );

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ versionId: 'ver-new', versionNumber: 3 });
    expect(createEstimateVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        estimateId: 'est-1',
        projectId: 'proj-1',
        versionNumber: 3,
        versionName: 'Quick Feasibility v3',
        estimateType: 'quick_feasibility',
        status: 'draft',
      }),
    );

    const createArg = createEstimateVersion.mock.calls[0][0];
    expect(createArg.snapshot.quickFeasibility).toEqual(
      expect.objectContaining({
        projectType: payload.inputs.projectType,
        locationCode: 'GU',
        squareFeet: 2_000,
        likelyTotal: payload.result.likelyTotal,
      }),
    );
    expect(createArg.snapshot).toEqual(
      expect.objectContaining({
        type: 'quick_feasibility',
        totals: expect.objectContaining({
          totalEstimate: payload.result.breakdown.totals.totalEstimate,
          laborCost: payload.result.breakdown.totals.laborCost,
          materialCost: payload.result.breakdown.totals.materialCost,
          equipmentCost: payload.result.breakdown.totals.equipmentCost,
          profit: payload.result.breakdown.totals.profit,
        }),
        labor: expect.objectContaining({
          laborHours: payload.result.breakdown.labor.laborHours,
          manDays: payload.result.breakdown.labor.manDays,
          crewDays: payload.result.breakdown.labor.crewDays,
          estimatedCrewSize: payload.result.breakdown.labor.estimatedCrewSize,
        }),
        schedule: expect.objectContaining({
          plannedDurationDays: payload.result.breakdown.schedule.plannedDurationDays,
        }),
        assumptions: expect.objectContaining({
          materialPercent: 0.45,
          laborPercent: 0.35,
          equipmentPercent: 0.05,
          overheadPercent: 0.1,
          profitPercent: 0.1,
        }),
      }),
    );
    expect(createArg.totals).toEqual(
      expect.objectContaining({
        finalSellPrice: payload.result.likelyTotal,
        laborCost: payload.result.breakdown.totals.laborCost,
        materialCost: payload.result.breakdown.totals.materialCost,
        equipmentCost: payload.result.breakdown.totals.equipmentCost,
        profit: payload.result.breakdown.totals.profit,
        laborHours: payload.result.breakdown.labor.laborHours,
        manDays: payload.result.breakdown.labor.manDays,
        crewDays: payload.result.breakdown.labor.crewDays,
        plannedDurationDays: payload.result.breakdown.schedule.plannedDurationDays,
        quickFeasibility: true,
      }),
    );
    expect(updateEstimateCurrentVersion).toHaveBeenCalledWith({
      estimateId: 'est-1',
      versionId: 'ver-new',
    });
    expect(insertEstimateLineItems).not.toHaveBeenCalled();
  });

  it('does not create a version when quick inputs are incomplete', async () => {
    const listEstimateVersions = vi.fn();
    const createEstimateVersion = vi.fn();
    const updateEstimateCurrentVersion = vi.fn();
    const inputs = createQuickFeasibilityInputsForLocation('GU', { areaSF: 0 });
    const result = calculateQuickFeasibilityEstimate(inputs);

    const saveResult = await saveQuickFeasibilityEstimate(
      {
        estimateId: 'est-1',
        projectId: 'proj-1',
        inputs,
        result,
      },
      {
        listEstimateVersions,
        createEstimateVersion,
        updateEstimateCurrentVersion,
      },
    );

    expect(saveResult.data).toBeNull();
    expect(saveResult.error).toContain('Enter building area');
    expect(createEstimateVersion).not.toHaveBeenCalled();
  });

  it('hydrates quick feasibility form inputs from a saved snapshot', async () => {
    const payload = quickPayload();
    const listEstimateVersions = vi.fn(async () => success([versionRow(1)]));
    const createEstimateVersion = vi.fn(async () =>
      success({ ...versionRow(2, 'ver-quick'), estimate_type: 'quick_feasibility' }),
    );
    const updateEstimateCurrentVersion = vi.fn(async () =>
      success({ id: 'est-1', currentVersionId: 'ver-quick' } as EstimateSummary),
    );

    await saveQuickFeasibilityEstimate(
      {
        estimateId: 'est-1',
        projectId: 'proj-1',
        inputs: payload.inputs,
        result: payload.result,
      },
      {
        listEstimateVersions,
        createEstimateVersion,
        updateEstimateCurrentVersion,
      },
    );

    const snapshot = createEstimateVersion.mock.calls[0][0].snapshot;
    const hydrated = quickFeasibilityInputsFromSnapshot(snapshot);

    expect(hydrated).toEqual(
      expect.objectContaining({
        locationCode: payload.inputs.locationCode,
        areaSF: payload.inputs.areaSF,
        projectType: payload.inputs.projectType,
        basePricePerSf: payload.inputs.basePricePerSf,
        contingencyPercent: payload.inputs.contingencyPercent,
        mepIntensity: payload.inputs.mepIntensity,
      }),
    );
  });
});
