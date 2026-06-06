import type { ReactNode } from 'react';
import {
  PLANNER_NAV_TAB_LABEL,
  PLANNER_NAV_TAB_LABEL_ACTIVE,
} from '../../../../components/planner/plannerTheme';

export type EstimateWorkspaceTabId =
  | 'overview'
  | 'line-items'
  | 'schedule-preview'
  | 'gantt-preview';

export interface EstimateWorkspaceTab {
  id: EstimateWorkspaceTabId;
  label: string;
}

export const ESTIMATE_WORKSPACE_TABS: EstimateWorkspaceTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'line-items', label: 'Estimate' },
  { id: 'schedule-preview', label: 'Schedule Preview' },
  { id: 'gantt-preview', label: 'Gantt Preview' },
];

export const REMOVED_ESTIMATE_WORKSPACE_TAB_IDS = ['totals'] as const;

interface Props {
  activeTabId: EstimateWorkspaceTabId;
  onTabChange: (tabId: EstimateWorkspaceTabId) => void;
  rightActions?: ReactNode;
}

export default function EstimateWorkspaceTabBar({
  activeTabId,
  onTabChange,
  rightActions,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <nav
        className="flex min-w-0 flex-1 gap-0 overflow-x-auto px-2 sm:px-4"
        aria-label="Estimate workspace sections"
      >
        {ESTIMATE_WORKSPACE_TABS.map((tab) => {
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
  );
}
