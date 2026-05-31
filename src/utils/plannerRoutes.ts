import type { NavigateFunction } from 'react-router-dom';

/** True when the route should use PlannerWorkspaceLayout (no photo bg, footer, bottom nav). */
export function isPlannerWorkspacePath(pathname: string): boolean {
  if (pathname.includes('/planner') || pathname.startsWith('/planner')) return true;
  if (pathname.startsWith('/employee/tasks')) return true;
  return false;
}

export type ScheduleViewParam = 'calendar' | 'timeline' | 'list' | 'milestone';
export type CalendarSubViewParam = 'month' | 'week' | 'work_week' | 'day' | 'agenda';

export function plannerScheduleHubHref(params?: {
  event?: string;
  view?: ScheduleViewParam;
  cal?: CalendarSubViewParam;
}): string {
  const base = '/planner/schedule';
  if (!params?.event && !params?.view && !params?.cal) return base;
  const q = new URLSearchParams();
  if (params.event) q.set('event', params.event);
  if (params.view) q.set('view', params.view);
  if (params.cal) q.set('cal', params.cal);
  return `${base}?${q.toString()}`;
}

export function plannerScheduleHref(
  projectId: string,
  params?: { event?: string; view?: ScheduleViewParam; cal?: CalendarSubViewParam },
): string {
  const base = `/projects/${projectId}/planner/schedule`;
  if (!params?.event && !params?.view && !params?.cal) return base;
  const q = new URLSearchParams();
  if (params.event) q.set('event', params.event);
  if (params.view) q.set('view', params.view);
  if (params.cal) q.set('cal', params.cal);
  return `${base}?${q.toString()}`;
}

export function plannerBoardHref(projectId: string, taskId?: string): string {
  const base = `/projects/${projectId}/planner/board`;
  if (!taskId) return base;
  return `${base}?task=${taskId}`;
}

const SAFE_PROJECT_PLANNER_SEGMENTS = new Set([
  'board',
  'charts',
  'schedule',
  'documents',
  'rfis',
  'adjustments',
  'team',
  'change-orders',
]);

const PROJECT_ENTITY_QUERY_KEYS = [
  'task',
  'rfi',
  'adjustment',
  'event',
  'safety',
  'inspection',
  'file',
  'far',
];

function appendQuery(path: string, query: string): string {
  return query ? `${path}?${query}` : path;
}

function sanitizeScheduleSearch(search: string): string {
  const params = new URLSearchParams(search);
  const view = params.get('view');
  const cal = params.get('cal');
  const next = new URLSearchParams();
  if (view) next.set('view', view);
  if (cal) next.set('cal', cal);
  return next.toString();
}

function sanitizeGeneralPlannerSearch(segment: string, search: string): string {
  const params = new URLSearchParams(search);
  for (const key of PROJECT_ENTITY_QUERY_KEYS) {
    params.delete(key);
  }
  if (segment === 'change-orders') {
    params.delete('far');
    params.delete('rfi');
    params.delete('task');
  }
  return params.toString();
}

function isSafeChangeOrdersSubPath(subPath: string): boolean {
  return subPath === 'change-orders' || subPath === 'change-orders/new';
}

/**
 * Build the URL when switching projects from the planner sidebar.
 * Preserves the current planner sub-route and schedule view when safe.
 */
export function plannerProjectSwitchHref(
  targetProjectId: string,
  location: { pathname: string; search: string },
): string {
  const { pathname, search } = location;

  if (pathname === '/planner/schedule' || pathname.startsWith('/planner/schedule/')) {
    const base = `/projects/${targetProjectId}/planner/schedule`;
    return appendQuery(base, sanitizeScheduleSearch(search));
  }

  const projectMatch = pathname.match(/^\/projects\/[^/]+\/planner(?:\/(.*))?$/);
  if (!projectMatch) {
    return plannerBoardHref(targetProjectId);
  }

  const subPath = projectMatch[1] ?? '';
  if (!subPath) {
    return plannerBoardHref(targetProjectId);
  }

  const firstSegment = subPath.split('/')[0];

  if (firstSegment === 'change-orders') {
    if (!isSafeChangeOrdersSubPath(subPath)) {
      return plannerBoardHref(targetProjectId);
    }
  } else if (!SAFE_PROJECT_PLANNER_SEGMENTS.has(firstSegment)) {
    return plannerBoardHref(targetProjectId);
  }

  const base = `/projects/${targetProjectId}/planner/${subPath}`;

  if (firstSegment === 'schedule') {
    return appendQuery(base, sanitizeScheduleSearch(search));
  }

  return appendQuery(base, sanitizeGeneralPlannerSearch(firstSegment, search));
}

export function plannerRfiHref(projectId: string, rfiId?: string): string {
  const base = `/projects/${projectId}/planner/rfis`;
  if (!rfiId) return base;
  return `${base}?rfi=${rfiId}`;
}

export function plannerAdjustmentHref(projectId: string, adjustmentId?: string): string {
  const base = `/projects/${projectId}/planner/adjustments`;
  if (!adjustmentId) return base;
  return `${base}?adjustment=${adjustmentId}`;
}

export function plannerDocumentsHref(
  projectId: string,
  highlight?: { safetyMeetingId?: string; inspectionId?: string; fileId?: string },
): string {
  const base = `/projects/${projectId}/planner/documents`;
  if (!highlight) return base;
  const q = new URLSearchParams();
  if (highlight.safetyMeetingId) q.set('safety', highlight.safetyMeetingId);
  if (highlight.inspectionId) q.set('inspection', highlight.inspectionId);
  if (highlight.fileId) q.set('file', highlight.fileId);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export function safetyMeetingToolHref(projectId: string, recordId?: string): string {
  const q = new URLSearchParams({ project: projectId });
  if (recordId) q.set('id', recordId);
  return `/tools/safety-meeting?${q.toString()}`;
}

export function concreteInspectionToolHref(projectId: string, recordId?: string): string {
  const q = new URLSearchParams({ project: projectId });
  if (recordId) q.set('id', recordId);
  return `/tools/concrete-inspection?${q.toString()}`;
}

export function changeOrderEditHref(projectId: string, changeOrderId: string): string {
  return `/projects/${projectId}/planner/change-orders/${changeOrderId}`;
}

export function changeOrderNewHref(
  projectId: string,
  params?: { far?: string; rfi?: string; task?: string },
): string {
  const base = `/projects/${projectId}/planner/change-orders/new`;
  if (!params) return base;
  const q = new URLSearchParams();
  if (params.far) q.set('far', params.far);
  if (params.rfi) q.set('rfi', params.rfi);
  if (params.task) q.set('task', params.task);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export function plannerChangeOrdersHref(projectId: string): string {
  return `/projects/${projectId}/planner/change-orders`;
}

export function plannerAllRfisHref(): string {
  return '/planner/rfis';
}

export function plannerAllFarsHref(): string {
  return '/planner/fars';
}

export function plannerAllChangeOrdersHref(): string {
  return '/planner/change-orders';
}

/** Close overlays first, then open the change-order builder (avoids search-param races on board/RFI/FAR pages). */
export function openNewChangeOrder(
  navigate: NavigateFunction,
  projectId: string,
  params?: { far?: string; rfi?: string; task?: string },
  onClose?: () => void,
): void {
  onClose?.();
  navigate(changeOrderNewHref(projectId, params));
}
