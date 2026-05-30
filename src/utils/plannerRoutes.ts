/** True when the route should use PlannerWorkspaceLayout (no photo bg, footer, bottom nav). */
export function isPlannerWorkspacePath(pathname: string): boolean {
  if (pathname.includes('/planner') || pathname.startsWith('/planner')) return true;
  if (pathname.startsWith('/employee/tasks')) return true;
  return false;
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
