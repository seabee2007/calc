import { describe, expect, it } from 'vitest';
import {
  estimateWorkspaceHref,
  isEstimateWorkspaceTabId,
  parseEstimateWorkspaceTabParam,
} from './estimateRoutes';

describe('estimateWorkspaceHref', () => {
  it('returns overview path without tab segment', () => {
    expect(estimateWorkspaceHref('proj-1')).toBe('/projects/proj-1/planner/estimate');
    expect(estimateWorkspaceHref('proj-1', 'overview')).toBe('/projects/proj-1/planner/estimate');
  });

  it('returns tab-specific paths', () => {
    expect(estimateWorkspaceHref('proj-1', 'line-items')).toBe(
      '/projects/proj-1/planner/estimate/line-items',
    );
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
  it('returns overview when segment is missing', () => {
    expect(parseEstimateWorkspaceTabParam(undefined)).toBe('overview');
  });

  it('returns tab id for valid segments', () => {
    expect(parseEstimateWorkspaceTabParam('line-items')).toBe('line-items');
    expect(parseEstimateWorkspaceTabParam('totals')).toBe('totals');
  });

  it('returns null for invalid segments', () => {
    expect(parseEstimateWorkspaceTabParam('unknown-tab')).toBeNull();
  });
});

describe('isEstimateWorkspaceTabId', () => {
  it('accepts known tab ids', () => {
    expect(isEstimateWorkspaceTabId('gantt-preview')).toBe(true);
  });

  it('rejects unknown tab ids', () => {
    expect(isEstimateWorkspaceTabId('board')).toBe(false);
  });
});
