import type { NavigateFunction } from 'react-router-dom';
import type { EstimateWorkspaceTabId } from '../features/estimating/ui/components/EstimateWorkspaceTabBar';
import {
  DEFAULT_ESTIMATE_WORKSPACE_TAB,
  estimateWorkspaceHref,
  isEstimateWorkspaceTabId,
} from '../features/estimating/utils/estimateRoutes';

/** Match a planner nav tab path; nested routes stay active unless exact is set. */
export function isPlannerNavTabActive(
  pathname: string,
  tabPath: string,
  options?: { exact?: boolean },
): boolean {
  if (options?.exact) {
    return pathname === tabPath;
  }

  return pathname === tabPath || pathname.startsWith(`${tabPath}/`);
}

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

export function plannerEstimateHref(projectId: string, tabId?: EstimateWorkspaceTabId): string {
  return estimateWorkspaceHref(projectId, tabId ?? DEFAULT_ESTIMATE_WORKSPACE_TAB);
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
  'estimate',
]);

const PROJECT_ENTITY_QUERY_KEYS = [
  'task',
  'rfi',
  'adjustment',
  'event',
  'safety',
  'inspection',
  'contract',
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

function isSafeEstimateSubPath(subPath: string): boolean {
  const segments = subPath.split('/');
  if (segments[0] !== 'estimate') return true;
  if (segments.length === 1) return true;
  if (segments.length === 2) return isEstimateWorkspaceTabId(segments[1]);
  return false;
}

/**
 * Build the URL when switching projects from the planner sidebar.
 * Preserves the current planner sub-route (including estimate tabs) when safe.
 */
export function buildProjectSwitchHref(
  currentPathname: string,
  nextProjectId: string,
  search = '',
): string {
  return plannerProjectSwitchHref(nextProjectId, { pathname: currentPathname, search });
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
  } else if (firstSegment === 'estimate') {
    if (!isSafeEstimateSubPath(subPath)) {
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
  highlight?: {
    tab?: string;
    safetyMeetingId?: string;
    inspectionId?: string;
    contractId?: string;
    fileId?: string;
    rfiId?: string;
    adjustmentId?: string;
  },
): string {
  const base = `/projects/${projectId}/planner/documents`;
  if (!highlight) return base;
  const q = new URLSearchParams();
  if (highlight.tab) q.set('tab', highlight.tab);
  if (highlight.safetyMeetingId) q.set('safety', highlight.safetyMeetingId);
  if (highlight.inspectionId) q.set('inspection', highlight.inspectionId);
  if (highlight.contractId) q.set('contract', highlight.contractId);
  if (highlight.fileId) q.set('file', highlight.fileId);
  if (highlight.rfiId) q.set('rfi', highlight.rfiId);
  if (highlight.adjustmentId) q.set('adjustment', highlight.adjustmentId);
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

export type ContractBuilderToolOptions = {
  packKey?: string;
  documentType?: string;
};

export function contractBuilderToolHref(
  projectId: string,
  documentId?: string,
  options?: ContractBuilderToolOptions,
): string {
  const q = new URLSearchParams({ project: projectId });
  if (documentId) q.set('id', documentId);
  if (options?.packKey) q.set('packKey', options.packKey);
  if (options?.documentType) q.set('documentType', options.documentType);
  return `/tools/contract-builder?${q.toString()}`;
}

/** Rejects non-string route ids (e.g. functions) before they reach react-router. */
export function assertValidChangeOrderRouteId(changeOrderId: unknown): string {
  if (typeof changeOrderId !== 'string') {
    throw new Error('Change order id must be a string');
  }
  const id = changeOrderId.trim();
  if (!id || id === 'new' || /[<>\s]/.test(id) || id.includes('function')) {
    throw new Error(`Invalid change order id: ${id || '(empty)'}`);
  }
  return id;
}

export function changeOrderEditHref(projectId: string, changeOrderId: string): string {
  const id = assertValidChangeOrderRouteId(changeOrderId);
  return `/projects/${projectId}/planner/change-orders/${id}`;
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
