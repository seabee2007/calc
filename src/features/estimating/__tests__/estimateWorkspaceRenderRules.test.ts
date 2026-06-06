import { describe, expect, it } from 'vitest';
import { mergeDivisionBucketsWithActivities } from '../application/estimateWorkBreakdown';
import {
  hasSelectedEstimateDivisions,
  mergePersistedAndSessionDivisionCodes,
  resolveDisplayedEstimateType,
  shouldShowBuilderDivisionBuckets,
  shouldShowEstimateBuilderPanel,
  shouldShowEstimateTypeSelectionOnTab,
  shouldShowOverviewFinancialSummary,
  shouldShowOverviewNoEstimateMessage,
} from '../ui/estimateWorkspaceRenderRules';
import { createEstimateSetupStartState } from '../application/estimateStartFlow';
import { shouldShowActivityWorkflow } from '../application/estimateStartFlow';

describe('estimateWorkspaceRenderRules', () => {
  it('does not render estimate type selection on overview', () => {
    expect(
      shouldShowEstimateTypeSelectionOnTab('overview', { isLoading: false, hasEstimate: false }),
    ).toBe(false);
    expect(
      shouldShowEstimateTypeSelectionOnTab('overview', { isLoading: false, hasEstimate: true }),
    ).toBe(false);
  });

  it('shows overview no-estimate message when no estimate exists', () => {
    expect(
      shouldShowOverviewNoEstimateMessage('overview', { isLoading: false, hasEstimate: false }),
    ).toBe(true);
    expect(
      shouldShowOverviewNoEstimateMessage('overview', { isLoading: false, hasEstimate: true }),
    ).toBe(false);
  });

  it('shows estimate type selection only on estimate tab when no estimate exists', () => {
    expect(
      shouldShowEstimateTypeSelectionOnTab('line-items', { isLoading: false, hasEstimate: false }),
    ).toBe(true);
    expect(
      shouldShowEstimateTypeSelectionOnTab('line-items', { isLoading: false, hasEstimate: true }),
    ).toBe(false);
  });

  it('shows estimate builder panel after estimate is started', () => {
    expect(
      shouldShowEstimateBuilderPanel('line-items', { isLoading: false, hasEstimate: true }),
    ).toBe(true);
    expect(
      shouldShowEstimateBuilderPanel('line-items', { isLoading: false, hasEstimate: false }),
    ).toBe(false);
  });

  it('shows overview financial summary only when estimate exists', () => {
    expect(
      shouldShowOverviewFinancialSummary('overview', { isLoading: false, hasEstimate: true }),
    ).toBe(true);
    expect(
      shouldShowOverviewFinancialSummary('overview', { isLoading: false, hasEstimate: false }),
    ).toBe(false);
  });

  it('merges persisted and session division codes for builder groups', () => {
    expect(
      mergePersistedAndSessionDivisionCodes(
        [{ code: '03', name: 'Concrete', source: 'manual', createdAt: '2026-06-06T00:00:00.000Z' }],
        ['09'],
      ),
    ).toEqual(['03', '09']);
  });

  it('shows builder buckets when persisted divisions exist without session codes', () => {
    const session = createEstimateSetupStartState('bid');
    expect(hasSelectedEstimateDivisions(
      [{ code: '03', name: 'Concrete', source: 'manual', createdAt: '2026-06-06T00:00:00.000Z' }],
      session.selectedDivisionCodes,
    )).toBe(true);
    expect(
      shouldShowBuilderDivisionBuckets(
        shouldShowActivityWorkflow(session),
        [{ code: '03', name: 'Concrete', source: 'manual', createdAt: '2026-06-06T00:00:00.000Z' }],
        session.selectedDivisionCodes,
      ),
    ).toBe(true);
  });

  it('renders collapsed division groups with zero line items from selected divisions', () => {
    const breakdown = mergeDivisionBucketsWithActivities(['03', '09'], [], []);
    expect(breakdown.divisions.map((division) => division.code)).toEqual(['03', '09']);
    expect(breakdown.divisions.every((division) => division.activityCount === 0)).toBe(true);
  });

  it('clears displayed estimate type when project has no estimate', () => {
    expect(resolveDisplayedEstimateType(null, null, 'detailed')).toBeNull();
    expect(resolveDisplayedEstimateType('detailed', null, 'bid')).toBe('detailed');
  });

  it('does not inherit previous project estimate type after switch', () => {
    expect(resolveDisplayedEstimateType('detailed', null, 'bid')).toBe('detailed');
    expect(resolveDisplayedEstimateType(null, null, 'bid')).toBeNull();
  });
});
