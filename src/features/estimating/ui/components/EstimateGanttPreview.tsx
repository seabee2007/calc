import { useMemo } from 'react';
import type { EstimateScheduleDatePlanResult } from '../../application/estimateScheduleDatePlanner';
import {
  buildGanttTimelineRange,
  calculateGanttTodayMarkerPosition,
  DEFAULT_GANTT_COLUMN_WIDTH_PX,
  extractGanttTasksFromPlan,
  getGanttTaskRows,
  getGanttTodayDateYmd,
  hasPlannedGanttTasks,
  isTodayWithinGanttRange,
} from '../estimateGanttDisplay';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
} from '../estimateWorkspaceTheme';
import EstimateWorkspaceEmptyState from './EstimateWorkspaceEmptyState';
import EstimateGanttRow from './EstimateGanttRow';
import EstimateGanttTimelineHeader from './EstimateGanttTimelineHeader';

const GANTT_PREVIEW_NOTE =
  'This Gantt is a preview generated from the estimate schedule plan. It has not been published to the Planner schedule.';

const NO_PLANNED_DATES_MESSAGE =
  'Choose a project start date in Schedule Preview to build a Gantt preview.';

interface Props {
  datePlanResult: EstimateScheduleDatePlanResult | null;
  loading?: boolean;
}

export default function EstimateGanttPreview({ datePlanResult, loading = false }: Props) {
  const plannedPlan = datePlanResult?.plan ?? null;
  const tasks = useMemo(() => extractGanttTasksFromPlan(plannedPlan), [plannedPlan]);
  const rows = useMemo(() => getGanttTaskRows(plannedPlan), [plannedPlan]);
  const range = useMemo(() => buildGanttTimelineRange(tasks), [tasks]);
  const todayYmd = useMemo(() => getGanttTodayDateYmd(), []);
  const showTodayMarker = isTodayWithinGanttRange(range, todayYmd);
  const todayMarkerLeft = calculateGanttTodayMarkerPosition(
    range.startDate,
    DEFAULT_GANTT_COLUMN_WIDTH_PX,
    todayYmd,
  );

  if (!loading && !hasPlannedGanttTasks(plannedPlan)) {
    return (
      <EstimateWorkspaceEmptyState
        title="No Gantt preview yet"
        body={NO_PLANNED_DATES_MESSAGE}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className={PLANNER_SECTION_TITLE}>Gantt preview</h2>
        <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>
          Day-scale timeline from planned schedule dates. Read-only preview — no drag or resize.
        </p>
      </div>

      <div className={`${PLANNER_FORM_PANEL} text-sm ${TEXT_BODY}`}>
        <p className={PLANNER_MUTED}>{GANTT_PREVIEW_NOTE}</p>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <div className="inline-flex min-w-full flex-col">
              <div className="flex">
                <div className="sticky left-0 z-20 flex h-10 w-44 shrink-0 items-end border-b border-r border-slate-200 bg-slate-50/95 px-2 pb-1 dark:border-slate-700 dark:bg-slate-800/95 sm:w-56">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>
                    Tasks
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <EstimateGanttTimelineHeader range={range} />
                </div>
              </div>

              <div>
                {rows.map((row) => (
                  <EstimateGanttRow
                    key={row.id}
                    row={row}
                    range={range}
                    todayMarkerLeft={showTodayMarker ? todayMarkerLeft : null}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
