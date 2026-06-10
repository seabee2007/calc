import type { ReactNode } from 'react';
import {
  PLANNER_NAV_TAB_LABEL,
  PLANNER_NAV_TAB_LABEL_ACTIVE,
} from '../../../../components/planner/plannerTheme';

export type EstimateWorkspaceTabId =
  | 'overview'
  | 'settings'
  | 'line-items'
  | 'activities'
  | 'quick-estimate'
  | 'conceptual-budget'
  | 'assumptions-allowances'
  | 'change-order-scope'
  | 'pricing'
  | 'unit-price-items'
  | 'subcontractor-quotes'
  | 'quote-comparison'
  | 'schedule-preview'
  | 'gantt-preview'   // kept for redirect only — not shown in tab bar
  | 'logic-network'
  | 'level-iii-gantt';

/** Default workspace tab — Construction Activities is the primary estimating workflow. */
export const DEFAULT_ESTIMATE_WORKSPACE_TAB: EstimateWorkspaceTabId = 'activities';

/**
 * Legacy Estimate/Line Items tab hidden while Construction Activities become the
 * primary estimating workflow. Tab id remains in routes/types for fallback rendering.
 */
export const LEGACY_HIDDEN_ESTIMATE_WORKSPACE_TAB_IDS = ['line-items'] as const;

export interface EstimateWorkspaceTab {
  id: EstimateWorkspaceTabId;
  label: string;
}

/** Tabs shown in the workspace sub-navigation. */
export const ESTIMATE_WORKSPACE_TABS: EstimateWorkspaceTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'settings', label: 'Settings' },
  { id: 'activities', label: 'Activities' },
  { id: 'schedule-preview', label: 'Schedule Preview' },
  { id: 'logic-network', label: 'Logic Network' },
  { id: 'level-iii-gantt', label: 'Level III Gantt' },
];

/** Legacy tab definitions kept for fallback code paths (not rendered in the tab bar). */
export const LEGACY_ESTIMATE_WORKSPACE_TABS: EstimateWorkspaceTab[] = [
  { id: 'line-items', label: 'Estimate' },
];

export const REMOVED_ESTIMATE_WORKSPACE_TAB_IDS = ['totals'] as const;

interface Props {
  activeTabId: EstimateWorkspaceTabId;
  visibleTabs?: EstimateWorkspaceTab[];
  onTabChange: (tabId: EstimateWorkspaceTabId) => void;
  rightActions?: ReactNode;
  estimateTypeControl?: ReactNode;
}

export default function EstimateWorkspaceTabBar({
  activeTabId,
  visibleTabs = ESTIMATE_WORKSPACE_TABS,
  onTabChange,
  rightActions,
  estimateTypeControl,
}: Props) {
  return (
    <div className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {estimateTypeControl ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 px-2 py-2 sm:px-4 dark:border-slate-800">
          {estimateTypeControl}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <nav
        className="flex min-w-0 flex-1 gap-0 overflow-x-auto px-2 sm:px-4"
        aria-label="Estimate workspace sections"
      >
        {visibleTabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors sm:px-4',
                isActive
                  ? `border-cyan-600 dark:border-cyan-400 ${PLANNER_NAV_TAB_LABEL_ACTIVE}`
                  : `border-transparent hover:text-gray-900 dark:hover:text-slate-200 ${PLANNER_NAV_TAB_LABEL}`,
              ].join(' ')}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
      {rightActions ? (
        <div className="flex shrink-0 items-center sm:px-4">{rightActions}</div>
      ) : null}
      </div>
    </div>
  );
}
