import type { EstimateWorkspaceTabId } from './EstimateWorkspaceTabBar';
import {
  BADGE_BASE,
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
} from '../estimateWorkspaceTheme';

interface Props {
  onNavigate: (tabId: EstimateWorkspaceTabId) => void;
}

const COMING_LATER_BADGE = `${BADGE_BASE} border border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300`;

export default function EstimateNextAvailableActions({ onNavigate }: Props) {
  return (
    <div className={`${PLANNER_FORM_PANEL} space-y-2 text-sm ${TEXT_BODY}`}>
      <p className={PLANNER_SECTION_TITLE}>Next steps</p>
      <ul className={`list-disc space-y-1.5 pl-5 ${TEXT_BODY}`}>
        <li>
          <button
            type="button"
            className="font-medium text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-400"
            onClick={() => onNavigate('line-items')}
          >
            Estimate
          </button>
          <span className={PLANNER_MUTED}>
            {' '}
            — select divisions of work, then add activities and cost details. They become the
            foundation for estimate totals, schedule preview, and Gantt planning.
          </span>
        </li>
        <li>
          <button
            type="button"
            className="font-medium text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-400"
            onClick={() => onNavigate('schedule-preview')}
          >
            Schedule Preview
          </button>
          <span className={PLANNER_MUTED}> — review planned dates.</span>
        </li>
        <li>
          <button
            type="button"
            className="font-medium text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-400"
            onClick={() => onNavigate('gantt-preview')}
          >
            Gantt Preview
          </button>
          <span className={PLANNER_MUTED}>
            {' '}
            — review timeline, dependencies, critical path, and baseline.
          </span>
        </li>
        <li className={`list-none pl-0 ${PLANNER_MUTED}`}>
          Proposal export will be added later.
          <span className={`ml-2 ${COMING_LATER_BADGE}`}>Coming later</span>
        </li>
      </ul>
    </div>
  );
}
