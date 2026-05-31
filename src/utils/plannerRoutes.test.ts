import { describe, expect, it } from 'vitest';
import { plannerProjectSwitchHref } from './plannerRoutes';

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
});
