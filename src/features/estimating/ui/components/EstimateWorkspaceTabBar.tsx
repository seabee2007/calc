import {
  PLANNER_NAV_TAB_LABEL,
  PLANNER_NAV_TAB_LABEL_ACTIVE,
} from '../../../../components/planner/plannerTheme';

export type EstimateWorkspaceTabId =
  | 'overview'
  | 'line-items'
  | 'schedule-preview'
  | 'versions'
  | 'totals';

export interface EstimateWorkspaceTab {
  id: EstimateWorkspaceTabId;
  label: string;
}

export const ESTIMATE_WORKSPACE_TABS: EstimateWorkspaceTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'line-items', label: 'Line items' },
  { id: 'schedule-preview', label: 'Schedule Preview' },
  { id: 'versions', label: 'Versions' },
  { id: 'totals', label: 'Totals' },
];

interface Props {
  activeTabId: EstimateWorkspaceTabId;
  onTabChange: (tabId: EstimateWorkspaceTabId) => void;
}

export default function EstimateWorkspaceTabBar({ activeTabId, onTabChange }: Props) {
  return (
    <nav
      className="flex gap-0 overflow-x-auto border-b border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-900 sm:px-4"
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
  );
}
