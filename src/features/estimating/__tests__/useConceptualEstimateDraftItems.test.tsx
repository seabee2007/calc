import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  conceptualEstimateFromAssumptions,
  conceptualEstimateToAssumptions,
} from '../application/conceptualEstimatePersistence';
import { DEFAULT_ESTIMATE_SETTINGS } from '../application/estimateSettings';
import type { CurrentEstimate } from '../application/currentEstimateService';
import { createEmptyConceptualEstimatePayload } from '../domain/conceptualEstimateTypes';
import {
  buildPayloadWithConceptualDraftItems,
  resetConceptualEstimateSessionCacheForTests,
  useConceptualEstimate,
  type ConceptualEstimateDraftItems,
} from '../ui/hooks/useConceptualEstimate';

function currentConceptualEstimate(
  assumptions = conceptualEstimateToAssumptions(createEmptyConceptualEstimatePayload()),
  overrides: Partial<CurrentEstimate> = {},
): CurrentEstimate {
  return {
    id: 'estimate-1',
    projectId: 'project-1',
    estimateType: 'conceptual',
    estimateTypeLabel: 'Conceptual Estimate',
    schedulingEnabled: false,
    estimateModeConfig: null,
    pricingMode: null,
    status: 'draft',
    selectedDivisions: [],
    lineItems: [],
    totals: {},
    summary: {},
    assumptions,
    createdBy: 'user-1',
    createdAt: '2026-06-06T00:00:00.000Z',
    updatedAt: '2026-06-06T01:00:00.000Z',
    ...overrides,
  };
}

const emptyDraftItems: ConceptualEstimateDraftItems = {
  assumption: {
    title: '',
    description: '',
    impact: 'cost',
  },
  exclusion: {
    title: '',
    reason: '',
    description: '',
  },
  allowanceNote: {
    title: '',
    includedAmount: '',
    description: '',
  },
};

describe('conceptual estimate draft item flushing', () => {
  beforeEach(() => {
    resetConceptualEstimateSessionCacheForTests();
  });

  it('does not create items for empty draft fields', () => {
    const payload = buildPayloadWithConceptualDraftItems(
      createEmptyConceptualEstimatePayload(),
      emptyDraftItems,
    );

    expect(payload.assumptions).toHaveLength(0);
    expect(payload.exclusions).toHaveLength(0);
    expect(payload.allowanceNotes).toHaveLength(0);
  });

  it('flushes assumption, exclusion, and allowance note drafts into the save payload', () => {
    const payload = buildPayloadWithConceptualDraftItems(createEmptyConceptualEstimatePayload(), {
      assumption: {
        title: 'Existing drawings are preliminary',
        description: 'Assumption typed but not explicitly added.',
        impact: 'scope',
      },
      exclusion: {
        title: 'Furniture',
        reason: 'Owner supplied',
        description: 'Exclusion typed but not explicitly added.',
      },
      allowanceNote: {
        title: 'Lighting allowance',
        includedAmount: '15000',
        description: 'Allowance typed but not explicitly added.',
      },
    });

    expect(payload.assumptions).toMatchObject([
      {
        title: 'Existing drawings are preliminary',
        description: 'Assumption typed but not explicitly added.',
        impact: 'scope',
      },
    ]);
    expect(payload.exclusions).toMatchObject([
      {
        title: 'Furniture',
        reason: 'Owner supplied',
        description: 'Exclusion typed but not explicitly added.',
      },
    ]);
    expect(payload.allowanceNotes).toMatchObject([
      {
        title: 'Lighting allowance',
        includedAmount: 15000,
        description: 'Allowance typed but not explicitly added.',
      },
    ]);
  });

  it('uses safe fallback titles instead of silently dropping partial draft data', () => {
    const payload = buildPayloadWithConceptualDraftItems(createEmptyConceptualEstimatePayload(), {
      ...emptyDraftItems,
      exclusion: {
        title: '',
        reason: 'Owner supplied',
        description: '',
      },
      allowanceNote: {
        title: '',
        includedAmount: '5000',
        description: 'Fixture allowance',
      },
    });

    expect(payload.exclusions[0]).toMatchObject({
      title: 'Owner supplied',
      reason: 'Owner supplied',
    });
    expect(payload.allowanceNotes[0]).toMatchObject({
      title: 'Fixture allowance',
      includedAmount: 5000,
    });
  });

  it('marks the controller dirty while draft fields contain unsaved visible text', () => {
    const estimate = currentConceptualEstimate();
    const { result } = renderHook(() =>
      useConceptualEstimate({
        estimate,
        estimateSettings: DEFAULT_ESTIMATE_SETTINGS,
      }),
    );

    expect(result.current.dirty).toBe(false);

    act(() => {
      result.current.updateExclusionDraft({
        title: 'Furniture',
        reason: 'Owner supplied',
        description: 'Visible draft text',
      });
    });

    expect(result.current.dirty).toBe(true);
    expect(result.current.hasDraftItems).toBe(true);
  });

  it('builds a global save payload with drafts, then clears drafts after DB-confirmed save', () => {
    const estimate = currentConceptualEstimate();
    const { result } = renderHook(() =>
      useConceptualEstimate({
        estimate,
        estimateSettings: DEFAULT_ESTIMATE_SETTINGS,
      }),
    );

    act(() => {
      result.current.updateAssumptionDraft({
        title: 'Preliminary design',
        description: 'Draft assumption',
      });
      result.current.updateExclusionDraft({
        title: 'Furniture',
        reason: 'Owner supplied',
        description: 'Draft exclusion',
      });
      result.current.updateAllowanceNoteDraft({
        title: 'Lighting allowance',
        includedAmount: '12000',
        description: 'Draft allowance',
      });
    });

    const payloadForSave = result.current.buildPayloadWithDraftItems();
    const savedAssumptions = conceptualEstimateToAssumptions(payloadForSave);

    expect(savedAssumptions.assumptions).toHaveLength(1);
    expect(savedAssumptions.exclusions).toHaveLength(1);
    expect(savedAssumptions.allowanceNotes).toHaveLength(1);

    act(() => {
      result.current.markSaved(
        currentConceptualEstimate(savedAssumptions),
      );
    });

    expect(result.current.dirty).toBe(false);
    expect(result.current.hasDraftItems).toBe(false);
    expect(result.current.draftItems.exclusion.title).toBe('');
    expect(result.current.payload.exclusions[0]?.title).toBe('Furniture');
    expect(result.current.payload.allowanceNotes[0]?.title).toBe('Lighting allowance');
  });

  it('reloads flushed draft items from the saved DB assumptions payload', () => {
    const payloadForSave = buildPayloadWithConceptualDraftItems(
      createEmptyConceptualEstimatePayload(),
      {
        ...emptyDraftItems,
        exclusion: {
          title: 'Furniture',
          reason: 'Owner supplied',
          description: 'Reloaded exclusion',
        },
        allowanceNote: {
          title: 'Lighting allowance',
          includedAmount: '12000',
          description: 'Reloaded allowance',
        },
      },
    );
    const reloaded = conceptualEstimateFromAssumptions(
      conceptualEstimateToAssumptions(payloadForSave),
    );

    expect(reloaded?.exclusions[0]?.title).toBe('Furniture');
    expect(reloaded?.allowanceNotes[0]?.includedAmount).toBe(12000);
  });

  it('preserves unsaved conceptual draft fields across hook unmount and remount', () => {
    const estimate = currentConceptualEstimate();
    const first = renderHook(() =>
      useConceptualEstimate({
        estimate,
        estimateSettings: DEFAULT_ESTIMATE_SETTINGS,
      }),
    );

    act(() => {
      first.result.current.updateExclusionDraft({
        title: 'Furniture',
        reason: 'Owner supplied',
        description: 'Keep this visible draft',
      });
      first.result.current.updateAllowanceNoteDraft({
        title: 'Lighting allowance',
        includedAmount: '9000',
        description: 'Keep this allowance draft',
      });
    });

    first.unmount();

    const second = renderHook(() =>
      useConceptualEstimate({
        estimate,
        estimateSettings: DEFAULT_ESTIMATE_SETTINGS,
      }),
    );

    expect(second.result.current.dirty).toBe(true);
    expect(second.result.current.hasDraftItems).toBe(true);
    expect(second.result.current.draftItems.exclusion.title).toBe('Furniture');
    expect(second.result.current.draftItems.allowanceNote.includedAmount).toBe('9000');
  });

  it('does not let a same-estimate background refresh overwrite dirty local draft state', () => {
    const estimate = currentConceptualEstimate();
    const { result, rerender } = renderHook(
      ({ current }) =>
        useConceptualEstimate({
          estimate: current,
          estimateSettings: DEFAULT_ESTIMATE_SETTINGS,
        }),
      { initialProps: { current: estimate } },
    );

    act(() => {
      result.current.updateExclusionDraft({
        title: 'Unsaved local exclusion',
      });
    });

    const refreshedPayload = createEmptyConceptualEstimatePayload();
    refreshedPayload.exclusions.push({
      id: 'exc-db',
      title: 'DB exclusion',
      description: 'Background refresh',
      reason: 'DB',
      createdAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T00:00:00.000Z',
    });

    rerender({
      current: currentConceptualEstimate(
        conceptualEstimateToAssumptions(refreshedPayload),
        { updatedAt: '2026-06-06T02:00:00.000Z' },
      ),
    });

    expect(result.current.draftItems.exclusion.title).toBe('Unsaved local exclusion');
    expect(result.current.payload.exclusions).toHaveLength(0);
  });

  it('applies newer DB payload when local conceptual state is clean', () => {
    const estimate = currentConceptualEstimate();
    const { result, rerender } = renderHook(
      ({ current }) =>
        useConceptualEstimate({
          estimate: current,
          estimateSettings: DEFAULT_ESTIMATE_SETTINGS,
        }),
      { initialProps: { current: estimate } },
    );

    const refreshedPayload = createEmptyConceptualEstimatePayload();
    refreshedPayload.revision.name = 'Updated from DB refresh';
    refreshedPayload.exclusions.push({
      id: 'exc-db',
      title: 'DB exclusion',
      description: 'Background refresh',
      reason: 'DB',
      createdAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T00:00:00.000Z',
    });

    rerender({
      current: currentConceptualEstimate(
        conceptualEstimateToAssumptions(refreshedPayload),
        { updatedAt: '2026-06-06T02:00:00.000Z' },
      ),
    });

    expect(result.current.payload.revision.name).toBe('Updated from DB refresh');
    expect(result.current.payload.exclusions[0]?.title).toBe('DB exclusion');
  });
});
