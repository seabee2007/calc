import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ESTIMATE_WORKSPACE_TAB,
  ESTIMATE_WORKSPACE_TAB_IDS,
  estimateWorkspaceHref,
  isEstimateWorkspaceTabId,
  parseEstimateWorkspaceTabParam,
} from './estimateRoutes';

describe('estimateWorkspaceHref', () => {
  it('returns Activities path when tab segment is omitted (default workflow)', () => {
    expect(estimateWorkspaceHref('proj-1')).toBe('/projects/proj-1/planner/estimate');
    expect(estimateWorkspaceHref('proj-1', DEFAULT_ESTIMATE_WORKSPACE_TAB)).toBe(
      '/projects/proj-1/planner/estimate',
    );
  });

  it('returns explicit overview path', () => {
    expect(estimateWorkspaceHref('proj-1', 'overview')).toBe(
      '/projects/proj-1/planner/estimate/overview',
    );
  });

  it('returns tab-specific paths', () => {
    expect(estimateWorkspaceHref('proj-1', 'settings')).toBe(
      '/projects/proj-1/planner/estimate/settings',
    );
    expect(estimateWorkspaceHref('proj-1', 'activities')).toBe('/projects/proj-1/planner/estimate');
    expect(estimateWorkspaceHref('proj-1', 'line-items')).toBe('/projects/proj-1/planner/estimate');
    expect(estimateWorkspaceHref('proj-1', 'gantt-preview')).toBe(
      '/projects/proj-1/planner/estimate/gantt-preview',
    );
    expect(estimateWorkspaceHref('proj-1', 'schedule-preview')).toBe(
      '/projects/proj-1/planner/estimate/schedule-preview',
    );
    expect(estimateWorkspaceHref('proj-1', 'versions')).toBe(
      '/projects/proj-1/planner/estimate/versions',
    );
  });
});

describe('parseEstimateWorkspaceTabParam', () => {
  it('returns Activities when segment is missing', () => {
    expect(parseEstimateWorkspaceTabParam(undefined)).toBe('activities');
  });

  it('returns tab id for valid segments', () => {
    expect(parseEstimateWorkspaceTabParam('settings')).toBe('settings');
    expect(parseEstimateWorkspaceTabParam('activities')).toBe('activities');
    expect(parseEstimateWorkspaceTabParam('overview')).toBe('overview');
    expect(parseEstimateWorkspaceTabParam('schedule-preview')).toBe('schedule-preview');
  });

  it('maps legacy line-items segment to Activities', () => {
    expect(parseEstimateWorkspaceTabParam('line-items')).toBe('activities');
  });

  it('maps legacy totals segment to overview', () => {
    expect(parseEstimateWorkspaceTabParam('totals')).toBe('overview');
    expect(ESTIMATE_WORKSPACE_TAB_IDS).not.toContain('totals');
  });

  it('returns null for invalid segments', () => {
    expect(parseEstimateWorkspaceTabParam('unknown-tab')).toBeNull();
  });
});

describe('isEstimateWorkspaceTabId', () => {
  it('accepts known tab ids', () => {
    expect(isEstimateWorkspaceTabId('gantt-preview')).toBe(true);
    expect(isEstimateWorkspaceTabId('line-items')).toBe(true);
  });

  it('rejects unknown and removed tab ids', () => {
    expect(isEstimateWorkspaceTabId('board')).toBe(false);
    expect(isEstimateWorkspaceTabId('totals')).toBe(false);
  });
});
