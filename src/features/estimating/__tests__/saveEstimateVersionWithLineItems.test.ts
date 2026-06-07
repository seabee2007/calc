import { describe, expect, it, vi } from 'vitest';
import {
  computeNextVersionNumber,
  saveEstimateVersionWithLineItems,
} from '../application/saveEstimateVersionWithLineItems';
import { createEmptyDraftLine } from '../application/estimateDraftLine';
import type {
  EstimateLineItemRow,
  EstimateSummary,
  EstimateVersionRow,
  RepositoryResult,
} from '../infrastructure/estimateDbTypes';

function success<T>(data: T): RepositoryResult<T> {
  return { data, error: null };
}

function fail<T>(error: string): RepositoryResult<T> {
  return { data: null, error };
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
    created_at: '2026-06-04T00:00:00.000Z',
  };
}

function buildPopulatedDraft() {
  const draft = createEmptyDraftLine(0, 'draft-1');
  draft.task.title = 'Pour slab';
  draft.task.scopeName = 'Flatwork';
  draft.task.lineItem.csiDivision = '03';
  draft.task.lineItem.csiSection = '03 30 00';
  draft.task.lineItem.quantity.quantity = 100;
  draft.unit = 'SF';
  draft.indirectCost = 50;
  draft.task.lineItem.labor = {
    productionRate: 10,
    productionRateType: 'units_per_labor_hour',
    hoursPerDay: 8,
    crewSize: 2,
    laborRate: 50,
    burdenPercent: 10,
  };
  draft.task.lineItem.material = { unitCost: 5 };
  draft.task.lineItem.equipment = { rate: 200, rateType: 'lump_sum', usageUnits: 1 };
  draft.task.lineItem.subcontractor = { cost: 100 };
  return draft;
}

const currentVersion = {
  estimateType: 'detailed' as const,
  status: 'draft' as const,
  snapshot: { pricing: { overheadPercent: 10, profitPercent: 5 } },
};

describe('computeNextVersionNumber', () => {
  it('returns 6 when existing versions are 1, 2, and 5', () => {
    expect(
      computeNextVersionNumber([versionRow(1), versionRow(2), versionRow(5)]),
    ).toBe(6);
  });
});

describe('saveEstimateVersionWithLineItems', () => {
  it('happy path creates version, inserts line items, and updates current_version_id', async () => {
    const listEstimateVersions = vi.fn(async () =>
      success([versionRow(1), versionRow(2)]),
    );
    const createEstimateVersion = vi.fn(async () => success(versionRow(3, 'ver-new')));
    const insertEstimateLineItems = vi.fn(async () =>
      success([{ id: 'line-1' } as EstimateLineItemRow]),
    );
    const updateEstimateCurrentVersion = vi.fn(async () =>
      success({ id: 'est-1', currentVersionId: 'ver-new' } as EstimateSummary),
    );

    const result = await saveEstimateVersionWithLineItems(
      {
        estimateId: 'est-1',
        projectId: 'proj-1',
        currentVersion,
        draftLines: [buildPopulatedDraft()],
        createdBy: 'user-1',
      },
      {
        listEstimateVersions,
        createEstimateVersion,
        insertEstimateLineItems,
        updateEstimateCurrentVersion,
      },
    );

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      versionId: 'ver-new',
      versionNumber: 3,
      lineItemCount: 1,
    });

    expect(listEstimateVersions).toHaveBeenCalledWith('est-1');
    expect(createEstimateVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        estimateId: 'est-1',
        projectId: 'proj-1',
        versionNumber: 3,
        versionName: 'Draft v3',
        status: 'draft',
      }),
    );
    expect(insertEstimateLineItems).toHaveBeenCalledWith(
      expect.objectContaining({
        lineItems: expect.arrayContaining([
          expect.objectContaining({
            estimate_version_id: 'ver-new',
            project_id: 'proj-1',
            position: 0,
            line_type: 'task',
            title: 'Pour slab',
            unit: 'SF',
          }),
        ]),
      }),
    );
    expect(updateEstimateCurrentVersion).toHaveBeenCalledWith({
      estimateId: 'est-1',
      versionId: 'ver-new',
    });
  });

  it('persists custom unit strings unchanged', async () => {
    const customDraft = buildPopulatedDraft();
    customDraft.unit = 'CUSTOM';

    const insertEstimateLineItems = vi.fn(async () =>
      success([{ id: 'line-1' } as EstimateLineItemRow]),
    );

    const result = await saveEstimateVersionWithLineItems(
      {
        estimateId: 'est-1',
        projectId: 'proj-1',
        currentVersion,
        draftLines: [customDraft],
        createdBy: 'user-1',
      },
      {
        listEstimateVersions: vi.fn(async () => success([versionRow(1)])),
        createEstimateVersion: vi.fn(async () => success(versionRow(2, 'ver-new'))),
        insertEstimateLineItems,
        updateEstimateCurrentVersion: vi.fn(async () =>
          success({ id: 'est-1', currentVersionId: 'ver-new' } as EstimateSummary),
        ),
      },
    );

    expect(result.error).toBeNull();
    expect(insertEstimateLineItems).toHaveBeenCalledWith(
      expect.objectContaining({
        lineItems: expect.arrayContaining([
          expect.objectContaining({
            unit: 'CUSTOM',
          }),
        ]),
      }),
    );
  });

  it('preserves selected divisions with no line items in the saved snapshot', async () => {
    const listEstimateVersions = vi.fn(async () =>
      success([versionRow(1), versionRow(2)]),
    );
    const createEstimateVersion = vi.fn(async () => success(versionRow(3, 'ver-new')));
    const insertEstimateLineItems = vi.fn(async () =>
      success([{ id: 'line-1' } as EstimateLineItemRow]),
    );
    const updateEstimateCurrentVersion = vi.fn(async () =>
      success({ id: 'est-1', currentVersionId: 'ver-new' } as EstimateSummary),
    );

    const result = await saveEstimateVersionWithLineItems(
      {
        estimateId: 'est-1',
        projectId: 'proj-1',
        currentVersion,
        draftLines: [buildPopulatedDraft()],
        selectedDivisions: [
          {
            code: '01',
            name: 'General Requirements',
            source: 'ai',
            confidence: 0.9,
            reason: 'The scope describes a construction project.',
            createdAt: '2026-06-06T00:00:00.000Z',
          },
          {
            code: '02',
            name: 'Existing Conditions',
            source: 'ai',
            confidence: 0.9,
            reason: 'Existing conditions are implied.',
            createdAt: '2026-06-06T00:00:00.000Z',
          },
          {
            code: '03',
            name: 'Concrete',
            source: 'ai',
            confidence: 0.95,
            reason: 'Concrete slab is directly named.',
            createdAt: '2026-06-06T00:00:00.000Z',
          },
          {
            code: '06',
            name: 'Wood, Plastics, and Composites',
            source: 'ai',
            confidence: 0.78,
            reason: 'Building work implies this division.',
            createdAt: '2026-06-06T00:00:00.000Z',
          },
          {
            code: '09',
            name: 'Finishes',
            source: 'ai',
            confidence: 0.78,
            reason: 'Finishes are implied.',
            createdAt: '2026-06-06T00:00:00.000Z',
          },
          {
            code: '22',
            name: 'Plumbing',
            source: 'ai',
            confidence: 0.88,
            reason: 'Plumbing is directly named.',
            createdAt: '2026-06-06T00:00:00.000Z',
          },
          {
            code: '23',
            name: 'HVAC',
            source: 'ai',
            confidence: 0.86,
            reason: 'HVAC is directly named.',
            createdAt: '2026-06-06T00:00:00.000Z',
          },
          {
            code: '32',
            name: 'Exterior Improvements',
            source: 'ai',
            confidence: 0.74,
            reason: 'Site paving is directly named.',
            createdAt: '2026-06-06T00:00:00.000Z',
          },
        ],
      },
      {
        listEstimateVersions,
        createEstimateVersion,
        insertEstimateLineItems,
        updateEstimateCurrentVersion,
      },
    );

    expect(result.error).toBeNull();
    const createArg = createEstimateVersion.mock.calls[0][0];
    expect(createArg.snapshot.selectedDivisions.map((division: { code: string }) => division.code)).toEqual([
      '01',
      '02',
      '03',
      '06',
      '09',
      '22',
      '23',
      '32',
    ]);
    expect(createArg.snapshot.lineItems.map((line: { csiDivision?: string }) => line.csiDivision)).toEqual([
      '03',
    ]);
  });

  it('returns error and does not create version when draftLines is empty', async () => {
    const createEstimateVersion = vi.fn();

    const result = await saveEstimateVersionWithLineItems(
      {
        estimateId: 'est-1',
        projectId: 'proj-1',
        currentVersion,
        draftLines: [],
      },
      {
        listEstimateVersions: vi.fn(),
        createEstimateVersion,
        insertEstimateLineItems: vi.fn(),
        updateEstimateCurrentVersion: vi.fn(),
      },
    );

    expect(result.data).toBeNull();
    expect(result.error).toMatch(/at least one draft line item/i);
    expect(createEstimateVersion).not.toHaveBeenCalled();
  });

  it('returns error when listEstimateVersions fails', async () => {
    const createEstimateVersion = vi.fn();

    const result = await saveEstimateVersionWithLineItems(
      {
        estimateId: 'est-1',
        projectId: 'proj-1',
        currentVersion,
        draftLines: [buildPopulatedDraft()],
      },
      {
        listEstimateVersions: vi.fn(async () => fail('List failed')),
        createEstimateVersion,
        insertEstimateLineItems: vi.fn(),
        updateEstimateCurrentVersion: vi.fn(),
      },
    );

    expect(result.data).toBeNull();
    expect(result.error).toBe('List failed');
    expect(createEstimateVersion).not.toHaveBeenCalled();
  });

  it('returns error and does not insert line items when createEstimateVersion fails', async () => {
    const insertEstimateLineItems = vi.fn();

    const result = await saveEstimateVersionWithLineItems(
      {
        estimateId: 'est-1',
        projectId: 'proj-1',
        currentVersion,
        draftLines: [buildPopulatedDraft()],
      },
      {
        listEstimateVersions: vi.fn(async () => success([versionRow(1)])),
        createEstimateVersion: vi.fn(async () => fail('Version create failed')),
        insertEstimateLineItems,
        updateEstimateCurrentVersion: vi.fn(),
      },
    );

    expect(result.data).toBeNull();
    expect(result.error).toBe('Version create failed');
    expect(insertEstimateLineItems).not.toHaveBeenCalled();
  });

  it('returns error and does not update current_version_id when insertEstimateLineItems fails', async () => {
    const updateEstimateCurrentVersion = vi.fn();

    const result = await saveEstimateVersionWithLineItems(
      {
        estimateId: 'est-1',
        projectId: 'proj-1',
        currentVersion,
        draftLines: [buildPopulatedDraft()],
      },
      {
        listEstimateVersions: vi.fn(async () => success([versionRow(1)])),
        createEstimateVersion: vi.fn(async () => success(versionRow(2, 'ver-2'))),
        insertEstimateLineItems: vi.fn(async () => fail('Line insert failed')),
        updateEstimateCurrentVersion,
      },
    );

    expect(result.data).toBeNull();
    expect(result.error).toBe('Line insert failed');
    expect(updateEstimateCurrentVersion).not.toHaveBeenCalled();
  });

  it('returns error when updateEstimateCurrentVersion fails after version and lines were created', async () => {
    const createEstimateVersion = vi.fn(async () => success(versionRow(6, 'ver-6')));
    const insertEstimateLineItems = vi.fn(async () =>
      success([{ id: 'line-1' } as EstimateLineItemRow, { id: 'line-2' } as EstimateLineItemRow]),
    );

    const result = await saveEstimateVersionWithLineItems(
      {
        estimateId: 'est-1',
        projectId: 'proj-1',
        currentVersion,
        draftLines: [buildPopulatedDraft(), buildPopulatedDraft()],
      },
      {
        listEstimateVersions: vi.fn(async () =>
          success([versionRow(1), versionRow(2), versionRow(5)]),
        ),
        createEstimateVersion,
        insertEstimateLineItems,
        updateEstimateCurrentVersion: vi.fn(async () => fail('Link failed')),
      },
    );

    expect(result.data).toBeNull();
    expect(result.error).toBe('Link failed');
    expect(createEstimateVersion).toHaveBeenCalledWith(
      expect.objectContaining({ versionNumber: 6 }),
    );
    expect(insertEstimateLineItems).toHaveBeenCalled();
  });
});
