import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ESTIMATE_WORKSPACE_TAB,
  ESTIMATE_WORKSPACE_TABS,
  LEGACY_HIDDEN_ESTIMATE_WORKSPACE_TAB_IDS,
} from '../ui/components/EstimateWorkspaceTabBar';
import {
  ESTIMATE_WORKSPACE_TAB_IDS,
  estimateWorkspaceHref,
  parseEstimateWorkspaceTabParam,
} from '../utils/estimateRoutes';
import {
  shouldShowEstimateBuilderPanel,
} from '../ui/estimateWorkspaceRenderRules';

const workspacePageSource = readFileSync(
  join(process.cwd(), 'src/features/estimating/ui/EstimateWorkspacePage.tsx'),
  'utf8',
);

describe('estimate workspace — Activities as primary workflow', () => {
  it('defaults to Activities tab when URL has no segment', () => {
    expect(parseEstimateWorkspaceTabParam(undefined)).toBe('activities');
    expect(DEFAULT_ESTIMATE_WORKSPACE_TAB).toBe('activities');
  });

  it('maps legacy line-items URL segment to Activities', () => {
    expect(parseEstimateWorkspaceTabParam('line-items')).toBe('activities');
  });

  it('does not show a fixed tab list — tabs adapt by estimate type', () => {
    expect(workspacePageSource).toContain('visibleTabs={visibleWorkspaceTabs}');
    expect(workspacePageSource).toContain('ChooseEstimateTypeModal');
    expect(workspacePageSource).toContain('EstimateTypeHeaderControl');
  });

  it('does not show legacy Estimate tab in the default detailed tab bar', () => {
    const visibleIds = ESTIMATE_WORKSPACE_TABS.map((tab) => tab.id);
    expect(visibleIds).not.toContain('line-items');
    expect(LEGACY_HIDDEN_ESTIMATE_WORKSPACE_TAB_IDS).toContain('line-items');
  });

  it('bare estimate workspace href opens Activities', () => {
    expect(estimateWorkspaceHref('proj-1')).toBe('/projects/proj-1/planner/estimate');
    expect(estimateWorkspaceHref('proj-1', 'activities')).toBe('/projects/proj-1/planner/estimate');
  });

  it('overview uses explicit /overview segment', () => {
    expect(estimateWorkspaceHref('proj-1', 'overview')).toBe(
      '/projects/proj-1/planner/estimate/overview',
    );
  });

  it('line-items href normalizes to bare Activities path', () => {
    expect(estimateWorkspaceHref('proj-1', 'line-items')).toBe('/projects/proj-1/planner/estimate');
  });

  it('keeps line-items in tab id union for fallback rendering', () => {
    expect(ESTIMATE_WORKSPACE_TAB_IDS).toContain('line-items');
  });

  it('EstimateWorkspacePage renders Construction Activities panel on activities tab', () => {
    expect(workspacePageSource).toContain("activeTab === 'activities'");
    expect(workspacePageSource).toContain('ConstructionActivityBuilderPanel');
  });

  it('locks Activities tab behind estimate type selection when no estimate exists', () => {
    expect(workspacePageSource).toContain('hasEstimateTypeSelected={hasEstimate}');
    expect(workspacePageSource).toContain('onChooseEstimateType={() => setEstimateTypeModalOpen(true)}');
  });

  it('EstimateWorkspacePage still renders schedule tabs', () => {
    expect(workspacePageSource).toContain("activeTab === 'schedule-preview'");
    expect(workspacePageSource).toContain("activeTab === 'logic-network'");
    expect(workspacePageSource).toContain("activeTab === 'level-iii-gantt'");
  });

  it('EstimateWorkspacePage keeps legacy line-items builder fallback code', () => {
    expect(workspacePageSource).toContain("activeTab === 'line-items'");
    expect(workspacePageSource).toContain('shouldShowEstimateBuilderPanel');
  });

  it('EstimateWorkspacePage redirects legacy line-items URLs to Activities', () => {
    expect(workspacePageSource).toContain("estimateTab === 'line-items'");
    expect(workspacePageSource).toContain("estimateWorkspaceHref(resolvedProjectId, 'activities')");
  });

  it('EstimateWorkspacePage uses construction activities schedule resolver', () => {
    expect(workspacePageSource).toContain('resolveEstimateWorkspaceScheduleActivities');
    expect(workspacePageSource).not.toContain('estimateLineItemsToScheduleActivities(');
  });

  it('legacy estimate builder render rule still exists for line-items fallback', () => {
    expect(
      shouldShowEstimateBuilderPanel('line-items', { isLoading: false, hasEstimate: true }),
    ).toBe(true);
  });
});
