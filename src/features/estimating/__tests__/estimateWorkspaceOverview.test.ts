import { describe, expect, it } from 'vitest';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import {
  ESTIMATE_OVERVIEW_FINANCIAL_SUMMARY_MARKER,
} from '../ui/components/EstimateTotalsReviewPanel';
import {
  ESTIMATE_WORKSPACE_TABS,
  REMOVED_ESTIMATE_WORKSPACE_TAB_IDS,
} from '../ui/components/EstimateWorkspaceTabBar';
import { buildEstimateTotalsReview } from '../ui/estimateTotalsDisplay';
import {
  shouldShowEstimateBuilderPanel,
  shouldShowOverviewFinancialSummary,
  shouldShowOverviewNoEstimateMessage,
} from '../ui/estimateWorkspaceRenderRules';
import {
  ESTIMATE_WORKSPACE_TAB_IDS,
  parseEstimateWorkspaceTabParam,
} from '../utils/estimateRoutes';

describe('estimate workspace overview tab', () => {
  it('removes the totals tab from sub-navigation', () => {
    expect(REMOVED_ESTIMATE_WORKSPACE_TAB_IDS).toContain('totals');
    expect(ESTIMATE_WORKSPACE_TABS.map((tab) => tab.id)).toEqual([
      'overview',
      'settings',
      'line-items',
      'schedule-preview',
      'gantt-preview',
    ]);
    expect(ESTIMATE_WORKSPACE_TAB_IDS).not.toContain('totals');
  });

  it('maps legacy totals URLs to overview', () => {
    expect(parseEstimateWorkspaceTabParam('totals')).toBe('overview');
  });

  it('shows financial summary on overview when an estimate exists', () => {
    expect(
      shouldShowOverviewFinancialSummary('overview', { isLoading: false, hasEstimate: true }),
    ).toBe(true);
    expect(
      shouldShowOverviewFinancialSummary('overview', { isLoading: false, hasEstimate: false }),
    ).toBe(false);
    expect(ESTIMATE_OVERVIEW_FINANCIAL_SUMMARY_MARKER).toBe(
      'estimate-overview-financial-summary',
    );
  });

  it('builds overview financial summary from the current saved estimate', () => {
    const snapshot = buildEstimateSnapshot(sampleEstimateVersion);
    const review = buildEstimateTotalsReview({
      id: 'ver-1',
      estimateId: 'est-1',
      projectId: 'proj-1',
      versionNumber: 1,
      versionName: 'Current',
      estimateType: 'bid',
      status: 'draft',
      snapshot,
      totals: snapshot.totals,
      notes: null,
      createdBy: null,
      createdAt: '2026-06-06T00:00:00.000Z',
      lineItems: [],
      warnings: [],
    });

    expect(review.hasTotals).toBe(true);
    expect(review.costGroups.finalSellPrice).toBeGreaterThan(0);
    expect(review.laborMetrics.laborHours).toBeGreaterThanOrEqual(0);
  });

  it('keeps estimate builder on the estimate tab', () => {
    expect(
      shouldShowEstimateBuilderPanel('line-items', { isLoading: false, hasEstimate: true }),
    ).toBe(true);
    expect(
      shouldShowOverviewNoEstimateMessage('overview', { isLoading: false, hasEstimate: false }),
    ).toBe(true);
  });
});
