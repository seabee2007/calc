import { describe, expect, it } from 'vitest';
import {
  getDefaultWorkspaceTabForEstimateType,
  getEstimateTypeChangeWarning,
  getEstimateTypeEmptyState,
  getVisibleWorkspaceTabs,
  isScheduleWorkspaceTab,
  isTabVisibleForEstimateType,
  resolveWorkspaceSchedulingEnabled,
} from '../application/estimateWorkspaceTabPolicy';
import { resolveEstimateWorkspaceScheduleActivities } from '../application/estimateWorkspaceScheduleSource';
import type { ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import { DEFAULT_ESTIMATE_METHOD } from '../domain/estimateMethods';

function makeActivity(): ProjectConstructionActivity {
  return {
    id: 'act-001',
    projectId: 'proj-001',
    divisionCode: '03',
    divisionName: 'Concrete',
    activityCode: '03-30-01',
    title: 'Place Slab on Grade',
    scheduleEnabled: true,
    crewSize: 4,
    hoursPerDay: 8,
    productionFactor: 1,
    calculatedManHours: 42,
    calculatedManDays: 5.25,
    calculatedDurationDays: 2,
    effectiveDurationDays: 2,
  };
}

describe('estimate workspace tab policy', () => {
  it('defaults estimate type to detailed', () => {
    expect(DEFAULT_ESTIMATE_METHOD).toBe('detailed');
    expect(getDefaultWorkspaceTabForEstimateType(undefined)).toBe('activities');
  });

  it('shows activities, 3D takeoff, and schedule tabs for detailed estimates', () => {
    const tabs = getVisibleWorkspaceTabs('detailed', true).map((tab) => tab.id);
    expect(tabs).toContain('activities');
    expect(tabs).toContain('3d-takeoff');
    expect(tabs).toContain('schedule-preview');
    expect(tabs).toContain('logic-network');
    expect(tabs).toContain('level-iii-gantt');
    expect(tabs).toContain('overview');
    expect(tabs).toContain('settings');
  });

  it('shows activities, 3D takeoff, and schedule tabs for bid estimates', () => {
    const tabs = getVisibleWorkspaceTabs('bid', true).map((tab) => tab.id);
    expect(tabs).toContain('activities');
    expect(tabs).toContain('3d-takeoff');
    expect(tabs).toContain('schedule-preview');
  });

  it('hides schedule tabs for quick estimates by default', () => {
    const tabs = getVisibleWorkspaceTabs('quick', false).map((tab) => tab.id);
    expect(tabs).toContain('quick-estimate');
    expect(tabs).not.toContain('schedule-preview');
    expect(tabs).not.toContain('logic-network');
    expect(tabs).not.toContain('level-iii-gantt');
    expect(tabs).not.toContain('3d-takeoff');
  });

  it('hides schedule tabs for conceptual estimates by default', () => {
    const tabs = getVisibleWorkspaceTabs('conceptual', false).map((tab) => tab.id);
    expect(tabs).toContain('conceptual-budget');
    expect(tabs).toContain('assumptions-allowances');
    expect(tabs).toContain('scenarios');
    expect(tabs).toContain('risks-contingency');
    expect(tabs).not.toContain('activities');
    expect(tabs).not.toContain('schedule-preview');
  });

  it('can optionally show schedule tabs when scheduling is enabled', () => {
    const tabs = getVisibleWorkspaceTabs('conceptual', true).map((tab) => tab.id);
    expect(tabs).toContain('schedule-preview');
    expect(tabs).toContain('logic-network');
  });

  it('resolves scheduling defaults by estimate type', () => {
    expect(resolveWorkspaceSchedulingEnabled('detailed', null)).toBe(true);
    expect(resolveWorkspaceSchedulingEnabled('quick', null)).toBe(false);
    expect(resolveWorkspaceSchedulingEnabled('detailed', false)).toBe(false);
  });

  it('warns when changing to a type that hides schedule tabs', () => {
    const warning = getEstimateTypeChangeWarning('detailed', 'subcontractor_quote', true);
    expect(warning.showWarning).toBe(true);
    expect(warning.title).toContain('Schedule tabs will be hidden');
  });

  it('provides estimate-type-specific empty states', () => {
    expect(getEstimateTypeEmptyState('detailed', 'activities').body).toContain(
      'detailed estimate',
    );
    expect(getEstimateTypeEmptyState('quick', 'quick-estimate').body).toContain(
      'unit pricing',
    );
  });

  it('identifies schedule tabs', () => {
    expect(isScheduleWorkspaceTab('logic-network')).toBe(true);
    expect(isScheduleWorkspaceTab('activities')).toBe(false);
  });

  it('checks tab visibility for the active estimate type', () => {
    expect(isTabVisibleForEstimateType('activities', 'detailed', true)).toBe(true);
    expect(isTabVisibleForEstimateType('activities', 'quick', false)).toBe(false);
    expect(isTabVisibleForEstimateType('quick-estimate', 'quick', false)).toBe(true);
  });
});

describe('estimate workspace schedule source with schedulingEnabled', () => {
  it('returns no schedule activities when schedulingEnabled is false', () => {
    const result = resolveEstimateWorkspaceScheduleActivities({
      constructionActivities: [makeActivity()],
      lineItems: [],
      estimateSettings: { defaultCrewSize: 4, hoursPerDay: 8 },
      schedulingEnabled: false,
    });

    expect(result.activities).toHaveLength(0);
  });

  it('allows construction activities to feed schedule tabs when schedulingEnabled is true', () => {
    const result = resolveEstimateWorkspaceScheduleActivities({
      constructionActivities: [makeActivity()],
      lineItems: [],
      estimateSettings: { defaultCrewSize: 4, hoursPerDay: 8 },
      schedulingEnabled: true,
    });

    expect(result.activities).toHaveLength(1);
  });
});
