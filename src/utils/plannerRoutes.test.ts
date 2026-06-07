import { describe, expect, it } from 'vitest';
import { buildProjectSwitchHref, isPlannerNavTabActive, plannerProjectSwitchHref } from './plannerRoutes';

const PROJECT_B = 'project-b';

function loc(pathname: string, search = '') {
  return { pathname, search: search ? (search.startsWith('?') ? search : `?${search}`) : '' };
}

describe('plannerProjectSwitchHref', () => {
  it('preserves schedule list view when switching projects', () => {
    expect(
      plannerProjectSwitchHref(PROJECT_B, loc('/projects/project-a/planner/schedule', 'view=list')),
    ).toBe('/projects/project-b/planner/schedule?view=list');
  });

  it('preserves schedule milestone view when switching projects', () => {
    expect(
      plannerProjectSwitchHref(
        PROJECT_B,
        loc('/projects/project-a/planner/schedule', 'view=milestone'),
      ),
    ).toBe('/projects/project-b/planner/schedule?view=milestone');
  });

  it('preserves schedule timeline view when switching projects', () => {
    expect(
      plannerProjectSwitchHref(
        PROJECT_B,
        loc('/projects/project-a/planner/schedule', 'view=timeline'),
      ),
    ).toBe('/projects/project-b/planner/schedule?view=timeline');
  });

  it('preserves calendar sub-views when switching projects', () => {
    for (const cal of ['agenda', 'month', 'week', 'day'] as const) {
      expect(
        plannerProjectSwitchHref(
          PROJECT_B,
          loc('/projects/project-a/planner/schedule', `view=calendar&cal=${cal}`),
        ),
      ).toBe(`/projects/project-b/planner/schedule?view=calendar&cal=${cal}`);
    }
  });

  it('strips event param on schedule switch', () => {
    expect(
      plannerProjectSwitchHref(
        PROJECT_B,
        loc('/projects/project-a/planner/schedule', 'view=list&event=evt-1'),
      ),
    ).toBe('/projects/project-b/planner/schedule?view=list');
  });

  it('maps global schedule to project schedule with same view params', () => {
    expect(
      plannerProjectSwitchHref(
        PROJECT_B,
        loc('/planner/schedule', 'view=calendar&cal=week'),
      ),
    ).toBe('/projects/project-b/planner/schedule?view=calendar&cal=week');
  });

  it('preserves rfis tab without entity query', () => {
    expect(
      plannerProjectSwitchHref(
        PROJECT_B,
        loc('/projects/project-a/planner/rfis', 'rfi=rfi-1'),
      ),
    ).toBe('/projects/project-b/planner/rfis');
  });

  it('falls back to board for change order detail routes', () => {
    expect(
      plannerProjectSwitchHref(
        PROJECT_B,
        loc('/projects/project-a/planner/change-orders/co-uuid-123'),
      ),
    ).toBe('/projects/project-b/planner/board');
  });

  it('falls back to board from planner hub context', () => {
    expect(plannerProjectSwitchHref(PROJECT_B, loc('/planner/hub'))).toBe(
      '/projects/project-b/planner/board',
    );
  });

  it('preserves board tab without task query', () => {
    expect(
      plannerProjectSwitchHref(
        PROJECT_B,
        loc('/projects/project-a/planner/board', 'task=task-1'),
      ),
    ).toBe('/projects/project-b/planner/board');
  });

  it('preserves change-orders list route', () => {
    expect(
      plannerProjectSwitchHref(PROJECT_B, loc('/projects/project-a/planner/change-orders')),
    ).toBe('/projects/project-b/planner/change-orders');
  });

  it('preserves change-orders new route without cross-link params', () => {
    expect(
      plannerProjectSwitchHref(
        PROJECT_B,
        loc('/projects/project-a/planner/change-orders/new', 'far=f1&rfi=r1&task=t1'),
      ),
    ).toBe('/projects/project-b/planner/change-orders/new');
  });

  it('preserves estimate line-items tab when switching projects', () => {
    expect(
      plannerProjectSwitchHref(
        PROJECT_B,
        loc('/projects/project-a/planner/estimate/line-items'),
      ),
    ).toBe('/projects/project-b/planner/estimate/line-items');
  });

  it('preserves estimate gantt-preview tab when switching projects', () => {
    expect(
      plannerProjectSwitchHref(
        PROJECT_B,
        loc('/projects/project-a/planner/estimate/gantt-preview'),
      ),
    ).toBe('/projects/project-b/planner/estimate/gantt-preview');
  });

  it('preserves estimate schedule-preview tab when switching projects', () => {
    expect(
      plannerProjectSwitchHref(
        PROJECT_B,
        loc('/projects/project-a/planner/estimate/schedule-preview'),
      ),
    ).toBe('/projects/project-b/planner/estimate/schedule-preview');
  });

  it('falls back to board for removed estimate versions tab', () => {
    expect(
      plannerProjectSwitchHref(PROJECT_B, loc('/projects/project-a/planner/estimate/versions')),
    ).toBe('/projects/project-b/planner/board');
  });

  it('preserves bare estimate route (overview) when switching projects', () => {
    expect(
      plannerProjectSwitchHref(PROJECT_B, loc('/projects/project-a/planner/estimate')),
    ).toBe('/projects/project-b/planner/estimate');
  });

  it('preserves planner documents route when switching projects', () => {
    expect(
      plannerProjectSwitchHref(PROJECT_B, loc('/projects/project-a/planner/documents')),
    ).toBe('/projects/project-b/planner/documents');
  });

  it('falls back to board for invalid estimate tab segments', () => {
    expect(
      plannerProjectSwitchHref(
        PROJECT_B,
        loc('/projects/project-a/planner/estimate/not-a-tab'),
      ),
    ).toBe('/projects/project-b/planner/board');
  });

  it('buildProjectSwitchHref matches plannerProjectSwitchHref', () => {
    expect(
      buildProjectSwitchHref('/projects/project-a/planner/estimate/totals', PROJECT_B),
    ).toBe('/projects/project-b/planner/board');
  });
});

describe('isPlannerNavTabActive', () => {
  const projectId = 'project-a';
  const estimateBasePath = `/projects/${projectId}/planner/estimate`;

  it('marks the main Estimate tab active on the estimate root route', () => {
    expect(isPlannerNavTabActive(estimateBasePath, estimateBasePath)).toBe(true);
  });

  it('marks the main Estimate tab active on nested estimate workspace routes', () => {
    for (const subPath of [
      'overview',
      'settings',
      'line-items',
      'schedule-preview',
      'logic-network',
      'level-iii-gantt',
    ]) {
      expect(
        isPlannerNavTabActive(`${estimateBasePath}/${subPath}`, estimateBasePath),
      ).toBe(true);
    }
  });

  it('does not mark Estimate active on unrelated planner routes', () => {
    expect(isPlannerNavTabActive(`/projects/${projectId}/planner/schedule`, estimateBasePath)).toBe(
      false,
    );
    expect(
      isPlannerNavTabActive(`/projects/${projectId}/planner/documents`, estimateBasePath),
    ).toBe(false);
  });

  it('supports exact matching when requested', () => {
    expect(
      isPlannerNavTabActive(`${estimateBasePath}/settings`, estimateBasePath, { exact: true }),
    ).toBe(false);
    expect(isPlannerNavTabActive(estimateBasePath, estimateBasePath, { exact: true })).toBe(true);
  });
});
