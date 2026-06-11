import type { EstimateWorkspaceTabId } from '../ui/components/EstimateWorkspaceTabBar';
import { DEFAULT_ESTIMATE_WORKSPACE_TAB } from '../ui/components/EstimateWorkspaceTabBar';

export { DEFAULT_ESTIMATE_WORKSPACE_TAB };
/** URL path segments for estimate workspace tabs (overview uses bare /estimate → activities). */
export const ESTIMATE_WORKSPACE_TAB_IDS = [
  'overview',
  'settings',
  'line-items',
  'activities',
  'quick-estimate',
  'conceptual-budget',
  'assumptions-allowances',
  'scenarios',
  'risks-contingency',
  'change-order-scope',
  'pricing',
  'unit-price-items',
  'subcontractor-quotes',
  'quote-comparison',
  'schedule-preview',
  'gantt-preview',
  'logic-network',
  'level-iii-gantt',
] as const satisfies readonly EstimateWorkspaceTabId[];

const ESTIMATE_WORKSPACE_TAB_ID_SET = new Set<string>(ESTIMATE_WORKSPACE_TAB_IDS);

export function isEstimateWorkspaceTabId(value: string): value is EstimateWorkspaceTabId {
  return ESTIMATE_WORKSPACE_TAB_ID_SET.has(value);
}

/** Normalize legacy/hidden tab segments to the active workspace tab. */
export function normalizeEstimateWorkspaceTabParam(
  tabSegment: string | undefined,
): EstimateWorkspaceTabId {
  const parsed = parseEstimateWorkspaceTabParamRaw(tabSegment);
  return parsed ?? DEFAULT_ESTIMATE_WORKSPACE_TAB;
}

function parseEstimateWorkspaceTabParamRaw(
  tabSegment: string | undefined,
): EstimateWorkspaceTabId | null {
  if (!tabSegment) return DEFAULT_ESTIMATE_WORKSPACE_TAB;
  if (tabSegment === 'totals') return 'overview';
  // Legacy Estimate tab → Construction Activities workflow
  if (tabSegment === 'line-items') return DEFAULT_ESTIMATE_WORKSPACE_TAB;
  // Redirect old gantt-preview links to level-iii-gantt
  if (tabSegment === 'gantt-preview') return 'level-iii-gantt';
  if (!isEstimateWorkspaceTabId(tabSegment)) return null;
  return tabSegment;
}

/** Parse an estimate tab segment from the URL; null when segment is invalid. */
export function parseEstimateWorkspaceTabParam(
  tabSegment: string | undefined,
): EstimateWorkspaceTabId | null {
  return parseEstimateWorkspaceTabParamRaw(tabSegment);
}

/** Project-scoped estimate workspace href; bare path opens Activities (default workflow). */
export function estimateWorkspaceHref(
  projectId: string,
  tabId: EstimateWorkspaceTabId = DEFAULT_ESTIMATE_WORKSPACE_TAB,
): string {
  const base = `/projects/${projectId}/planner/estimate`;
  if (tabId === DEFAULT_ESTIMATE_WORKSPACE_TAB) return base;
  if (tabId === 'line-items') {
    // Never link to legacy tab — normalize to Activities.
    return base;
  }
  if (tabId === 'overview') return `${base}/overview`;
  return `${base}/${tabId}`;
}
