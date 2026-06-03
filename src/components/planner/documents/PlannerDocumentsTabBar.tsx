import type { DocumentsTabId } from './documentsTabConfig';
import {
  PLANNER_NAV_TAB_LABEL,
  PLANNER_NAV_TAB_LABEL_ACTIVE,
} from '../plannerTheme';

export interface DocumentsTabItem {
  id: DocumentsTabId;
  label: string;
}

interface Props {
  tabs: DocumentsTabItem[];
  activeTabId: DocumentsTabId;
  onTabChange: (tabId: DocumentsTabId) => void;
}

export default function PlannerDocumentsTabBar({ tabs, activeTabId, onTabChange }: Props) {
  return (
    <nav
      className="flex gap-0 overflow-x-auto border-b border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-900 sm:px-4"
      aria-label="Document sections"
    >
      {tabs.map((tab) => {
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
