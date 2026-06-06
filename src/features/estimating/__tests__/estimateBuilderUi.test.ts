import { describe, expect, it } from 'vitest';
import { collectDivisionFilterOptions } from '../application/estimateLineItemGrouping';
import { createEstimateSetupStartState } from '../application/estimateStartFlow';
import { mergeDivisionBucketsWithActivities } from '../application/estimateWorkBreakdown';
import type { EstimateGroupedDivision } from '../domain/estimateLineItemTree';
import {
  createEstimateSaveSuccessToast,
  ESTIMATE_SAVE_TOAST_MESSAGE,
  REMOVED_ESTIMATE_BUILDER_LABELS,
  REMOVED_ESTIMATE_BUILDER_SUMMARY_CARD_LABELS,
  REMOVED_ESTIMATE_FILTER_LABELS,
  shouldRenderEstimateBuilderSummaryCards,
  shouldRenderInlineEstimateSuccessBanner,
  shouldShowEstimateBuilderHelperText,
} from '../ui/estimateBuilderUi';
import { shouldShowBuilderDivisionBuckets } from '../ui/estimateWorkspaceRenderRules';
import { shouldShowActivityWorkflow } from '../application/estimateStartFlow';

describe('estimateBuilderUi', () => {
  it('uses a toast for save success instead of an inline banner', () => {
    expect(shouldRenderInlineEstimateSuccessBanner()).toBe(false);
    expect(createEstimateSaveSuccessToast()).toEqual({
      message: ESTIMATE_SAVE_TOAST_MESSAGE,
      durationMs: 2500,
      placement: 'bottom-right',
    });
  });

  it('hides instructional helper text when the division builder is visible', () => {
    const session = {
      ...createEstimateSetupStartState('bid'),
      selectedDivisionCodes: ['01'],
    };

    expect(
      shouldShowEstimateBuilderHelperText({
        showQuickFeasibilityPanel: false,
        showBucketPanel: shouldShowBuilderDivisionBuckets(
          shouldShowActivityWorkflow(session),
          [{ code: '01', name: 'General Requirements', source: 'manual', createdAt: '2026-06-06T00:00:00.000Z' }],
          session.selectedDivisionCodes,
        ),
      }),
    ).toBe(false);
  });

  it('documents removed builder labels that should not appear in the compact UI', () => {
    expect(REMOVED_ESTIMATE_BUILDER_LABELS).toContain('Filters');
    expect(REMOVED_ESTIMATE_BUILDER_LABELS).toContain('Division of Work');
    expect(REMOVED_ESTIMATE_BUILDER_LABELS).toContain('Work Package / Scope');
    expect(REMOVED_ESTIMATE_BUILDER_LABELS).toContain(
      'Build your estimate by division of work, work package, and activity.',
    );
  });

  it('keeps division filter chip options available', () => {
    const groups: EstimateGroupedDivision<{ id: string }>[] = [
      {
        key: '01',
        label: '01 - General Requirements',
        scopes: [
          {
            key: 'mobilization',
            label: 'Mobilization',
            divisionKey: '01',
            items: [{ id: 'line-1' }],
            minPosition: 0,
            rollup: {
              itemCount: 1,
              laborHours: 0,
              manDays: 0,
              crewDays: 0,
              durationDays: 0,
              directCost: 0,
              materialCost: 0,
              equipmentCost: 0,
              subcontractorCost: 0,
              indirectCost: 0,
              sellPrice: 0,
              scheduleEnabledCount: 0,
              weatherSensitiveCount: 0,
              inspectionRequiredCount: 0,
            },
          },
        ],
        rollup: {
          itemCount: 1,
          laborHours: 0,
          manDays: 0,
          crewDays: 0,
          durationDays: 0,
          directCost: 0,
          materialCost: 0,
          equipmentCost: 0,
          subcontractorCost: 0,
          indirectCost: 0,
          sellPrice: 0,
          scheduleEnabledCount: 0,
          weatherSensitiveCount: 0,
          inspectionRequiredCount: 0,
        },
      },
    ];

    expect(collectDivisionFilterOptions(groups).map((option) => option.label)).toEqual([
      '01 - General Requirements',
    ]);
  });

  it('documents removed work package filter labels from the estimate tab', () => {
    expect(REMOVED_ESTIMATE_FILTER_LABELS).toContain('Work Package');
    expect(REMOVED_ESTIMATE_FILTER_LABELS).toContain('All work packages');
  });

  it('does not render top summary cards on the estimate tab', () => {
    expect(shouldRenderEstimateBuilderSummaryCards()).toBe(false);
    expect(REMOVED_ESTIMATE_BUILDER_SUMMARY_CARD_LABELS).toEqual([
      'Activities',
      'Labor Hours',
      'Man-Days',
      'Crew-Days',
      'Total',
    ]);
  });

  it('still builds collapsed division groups from selected divisions without line items', () => {
    const breakdown = mergeDivisionBucketsWithActivities(['01', '03'], [], []);
    expect(breakdown.divisions.map((division) => division.code)).toEqual(['01', '03']);
    expect(breakdown.divisions.every((division) => division.activityCount === 0)).toBe(true);
  });
});
