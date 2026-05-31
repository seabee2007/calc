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

export function plannerDocumentsHref(projectId: string, fileId?: string): string {
  const base = `/projects/${projectId}/planner/documents`;
  if (!fileId) return base;
  return `${base}?file=${fileId}`;
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
