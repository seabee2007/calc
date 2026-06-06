import type { EstimateWorkspaceTabId } from '../ui/components/EstimateWorkspaceTabBar';

/** URL path segments for estimate workspace tabs (overview uses bare /estimate). */
export const ESTIMATE_WORKSPACE_TAB_IDS = [
  'overview',
  'settings',
  'line-items',
  'schedule-preview',
  'gantt-preview',
] as const satisfies readonly EstimateWorkspaceTabId[];

const ESTIMATE_WORKSPACE_TAB_ID_SET = new Set<string>(ESTIMATE_WORKSPACE_TAB_IDS);

export function isEstimateWorkspaceTabId(value: string): value is EstimateWorkspaceTabId {
  return ESTIMATE_WORKSPACE_TAB_ID_SET.has(value);
}

/** Parse an estimate tab segment from the URL; null when segment is invalid. */
export function parseEstimateWorkspaceTabParam(
  tabSegment: string | undefined,
): EstimateWorkspaceTabId | null {
  if (!tabSegment) return 'overview';
  if (tabSegment === 'totals') return 'overview';
  if (!isEstimateWorkspaceTabId(tabSegment)) return null;
  return tabSegment;
}

/** Project-scoped estimate workspace href; overview omits the tab segment. */
export function estimateWorkspaceHref(
  projectId: string,
  tabId: EstimateWorkspaceTabId = 'overview',
): string {
  const base = `/projects/${projectId}/planner/estimate`;
  if (tabId === 'overview') return base;
  return `${base}/${tabId}`;
}
