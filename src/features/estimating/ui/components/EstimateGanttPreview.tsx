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
  buildGanttScaledTimeline,
  calculateGanttBodyHeight,
  calculateGanttTodayMarkerPositionForScale,
  DEFAULT_GANTT_TIMELINE_SCALE,
  extractGanttTasksFromPlan,
  formatGanttDependencyPreviewNote,
  GANTT_BASELINE_PREVIEW_NOTE,
  GANTT_DEPENDENCY_LINES_NOTE,
  getGanttTaskRows,
  getGanttTodayDateYmd,
  hasPlannedGanttTasks,
  isTodayWithinGanttRange,
  type GanttTimelineScale,
} from '../estimateGanttDisplay';
import { buildGanttDependencyConnectors } from '../estimateGanttDependenciesDisplay';
import {
  BADGE_BASE,
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
import EstimateGanttScaleControls from './EstimateGanttScaleControls';
import EstimateGanttTimelineHeader from './EstimateGanttTimelineHeader';

const GANTT_PREVIEW_NOTE =
  'This Gantt is a preview generated from the estimate schedule plan. It has not been published to the Planner schedule.';

const NO_PLANNED_DATES_MESSAGE =
  'Choose a project start date in Schedule Preview to build a Gantt preview.';

const MIN_GANTT_CHART_HEIGHT_PX = 480;

const PREVIEW_BADGE = `${BADGE_BASE} border border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300`;

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
  const [timelineScale, setTimelineScale] = useState<GanttTimelineScale>(DEFAULT_GANTT_TIMELINE_SCALE);
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
  const timeline = useMemo(
    () => buildGanttScaledTimeline(tasks, timelineScale),
    [tasks, timelineScale],
  );
  const criticalPathResult = useMemo(
    () => calculateEstimateCriticalPath(plannedPlan, dependencies),
    [plannedPlan, dependencies],
  );
  const dependencyConnectors = useMemo(
    () => buildGanttDependencyConnectors(dependencies, rows, timeline),
    [dependencies, rows, timeline],
  );
  const bodyHeight = useMemo(() => calculateGanttBodyHeight(rows), [rows]);
  const chartHeight = Math.max(bodyHeight + 48, MIN_GANTT_CHART_HEIGHT_PX);
  const timelineWidth = timeline.totalWidthPx;
  const todayYmd = useMemo(() => getGanttTodayDateYmd(), []);
  const showTodayMarker = isTodayWithinGanttRange(timeline, todayYmd);
  const todayMarkerLeft = calculateGanttTodayMarkerPositionForScale(timeline, todayYmd);

  if (!loading && !hasPlannedGanttTasks(plannedPlan)) {
    return (
      <EstimateWorkspaceEmptyState
        title="No Gantt preview yet"
        body={NO_PLANNED_DATES_MESSAGE}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className={PLANNER_SECTION_TITLE}>Gantt preview</h2>
          <p className={`mt-0.5 text-sm ${PLANNER_MUTED}`}>
            Read-only timeline — no drag or resize.
          </p>
        </div>
        <span className={PREVIEW_BADGE}>Preview only</span>
      </div>

      <div className={`${PLANNER_FORM_PANEL} space-y-3 text-sm ${TEXT_BODY}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <EstimateGanttScaleControls
            scale={timelineScale}
            onScaleChange={setTimelineScale}
            disabled={loading}
            compact
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600"
                checked={showDependencyLines}
                onChange={(event) => setShowDependencyLines(event.target.checked)}
              />
              Dependency lines
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600"
                checked={showCriticalPath}
                onChange={(event) => setShowCriticalPath(event.target.checked)}
              />
              Critical path
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600"
                checked={showBaseline}
                onChange={(event) => setShowBaseline(event.target.checked)}
              />
              Baseline
            </label>
          </div>
        </div>
      </div>

      {loading ? (
        <div
          className="animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60"
          style={{ minHeight: MIN_GANTT_CHART_HEIGHT_PX }}
        />
      ) : (
        <div
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
          style={{ minHeight: chartHeight }}
        >
          <div className="h-full overflow-x-auto overflow-y-auto">
            <div className="inline-flex min-w-full flex-col">
              <div className="flex">
                <div className="sticky left-0 z-20 flex h-10 w-44 shrink-0 items-end border-b border-r border-slate-200 bg-slate-50/95 px-2 pb-1 dark:border-slate-700 dark:bg-slate-800/95 sm:w-56">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>
                    Tasks
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <EstimateGanttTimelineHeader timeline={timeline} />
                </div>
              </div>

              <div className="relative" style={{ minHeight: bodyHeight }}>
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
                    timeline={timeline}
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

      {showBaseline ? (
        <EstimateBaselineSummary baseline={scheduleBaseline} loading={loading} />
      ) : null}

      {showCriticalPath ? (
        <EstimateCriticalPathSummary result={criticalPathResult} loading={loading} />
      ) : null}

      <div className={`${PLANNER_FORM_PANEL} space-y-1 text-xs ${PLANNER_MUTED}`}>
        <p>{GANTT_PREVIEW_NOTE}</p>
        <p>{formatGanttDependencyPreviewNote(dependencies.length)}</p>
        <p>{GANTT_DEPENDENCY_LINES_NOTE}</p>
        {showBaseline ? <p>{GANTT_BASELINE_PREVIEW_NOTE}</p> : null}
        <p>Long timelines keep horizontal scroll instead of shrinking columns.</p>
      </div>
    </div>
  );
}
