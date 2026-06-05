import { useMemo, useState } from 'react';
import { calculateEstimateCriticalPath } from '../../application/estimateCriticalPath';
import {
  buildEstimateScheduleBaseline,
  buildEstimateScheduleBaselineTaskMap,
} from '../../application/estimateScheduleBaseline';
import {
  applyDependencyPreviewToPlan,
  inferDependencyPreviewModeFromPlannedPlan,
} from '../../application/estimateScheduleDependencies';
import type { EstimateScheduleDatePlanResult } from '../../application/estimateScheduleDatePlanner';
import {
  buildGanttTimelineRange,
  calculateGanttBodyHeight,
  calculateGanttTodayMarkerPosition,
  DEFAULT_GANTT_COLUMN_WIDTH_PX,
  extractGanttTasksFromPlan,
  formatGanttDependencyPreviewNote,
  GANTT_BASELINE_PREVIEW_NOTE,
  GANTT_DEPENDENCY_LINES_NOTE,
  getGanttTaskRows,
  getGanttTodayDateYmd,
  hasPlannedGanttTasks,
  isTodayWithinGanttRange,
} from '../estimateGanttDisplay';
import { buildGanttDependencyConnectors } from '../estimateGanttDependenciesDisplay';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
} from '../estimateWorkspaceTheme';
import EstimateWorkspaceEmptyState from './EstimateWorkspaceEmptyState';
import EstimateBaselineSummary from './EstimateBaselineSummary';
import EstimateCriticalPathSummary from './EstimateCriticalPathSummary';
import EstimateGanttDependencyLayer from './EstimateGanttDependencyLayer';
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
  const dependencyPreview = useMemo(() => {
    if (!plannedPlan) return null;
    const mode = inferDependencyPreviewModeFromPlannedPlan(plannedPlan);
    return applyDependencyPreviewToPlan(plannedPlan, mode);
  }, [plannedPlan]);
  const dependencies = dependencyPreview?.dependencies ?? [];
  const [showDependencyLines, setShowDependencyLines] = useState(true);
  const [showCriticalPath, setShowCriticalPath] = useState(() => dependencies.length > 0);
  const [showBaseline, setShowBaseline] = useState(false);
  const scheduleBaseline = useMemo(
    () => buildEstimateScheduleBaseline(plannedPlan),
    [plannedPlan],
  );
  const baselineTaskMap = useMemo(
    () => buildEstimateScheduleBaselineTaskMap(scheduleBaseline),
    [scheduleBaseline],
  );
  const tasks = useMemo(() => extractGanttTasksFromPlan(plannedPlan), [plannedPlan]);
  const rows = useMemo(
    () => getGanttTaskRows(plannedPlan, dependencies),
    [plannedPlan, dependencies],
  );
  const range = useMemo(() => buildGanttTimelineRange(tasks), [tasks]);
  const criticalPathResult = useMemo(
    () => calculateEstimateCriticalPath(plannedPlan, dependencies),
    [plannedPlan, dependencies],
  );
  const dependencyConnectors = useMemo(
    () => buildGanttDependencyConnectors(dependencies, rows, range, DEFAULT_GANTT_COLUMN_WIDTH_PX),
    [dependencies, rows, range],
  );
  const bodyHeight = useMemo(() => calculateGanttBodyHeight(rows), [rows]);
  const timelineWidth = range.totalDays * DEFAULT_GANTT_COLUMN_WIDTH_PX;
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

      <div className={`${PLANNER_FORM_PANEL} space-y-3 text-sm ${TEXT_BODY}`}>
        <p className={PLANNER_MUTED}>{GANTT_PREVIEW_NOTE}</p>
        <p className={PLANNER_MUTED}>{formatGanttDependencyPreviewNote(dependencies.length)}</p>
        <p className={PLANNER_MUTED}>{GANTT_DEPENDENCY_LINES_NOTE}</p>
        <label className={`flex items-center gap-2 text-sm ${TEXT_BODY}`}>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600"
            checked={showDependencyLines}
            onChange={(event) => setShowDependencyLines(event.target.checked)}
          />
          Show dependency lines
        </label>
        <label className={`flex items-center gap-2 text-sm ${TEXT_BODY}`}>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600"
            checked={showCriticalPath}
            onChange={(event) => setShowCriticalPath(event.target.checked)}
          />
          Show critical path
        </label>
        <p className={PLANNER_MUTED}>{GANTT_BASELINE_PREVIEW_NOTE}</p>
        <label className={`flex items-center gap-2 text-sm ${TEXT_BODY}`}>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600"
            checked={showBaseline}
            onChange={(event) => setShowBaseline(event.target.checked)}
          />
          Show baseline
        </label>
      </div>

      {showBaseline ? (
        <EstimateBaselineSummary baseline={scheduleBaseline} loading={loading} />
      ) : null}

      <EstimateCriticalPathSummary result={criticalPathResult} loading={loading} />

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

              <div className="relative">
                {showDependencyLines ? (
                  <div
                    className="pointer-events-none absolute top-0 z-0 w-44 sm:w-56"
                    aria-hidden
                  >
                    <div
                      className="relative left-full"
                      style={{ width: timelineWidth, height: bodyHeight }}
                    >
                      <EstimateGanttDependencyLayer
                        connectors={dependencyConnectors}
                        width={timelineWidth}
                        height={bodyHeight}
                      />
                    </div>
                  </div>
                ) : null}

                {rows.map((row) => (
                  <EstimateGanttRow
                    key={row.id}
                    row={row}
                    range={range}
                    todayMarkerLeft={showTodayMarker ? todayMarkerLeft : null}
                    criticalTaskIds={criticalPathResult.criticalTaskIds}
                    showCriticalPath={showCriticalPath}
                    baselineTask={
                      row.task ? baselineTaskMap.get(row.task.candidateId) : undefined
                    }
                    showBaseline={showBaseline}
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
