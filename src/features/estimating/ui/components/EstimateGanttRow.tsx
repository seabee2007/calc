import { ArrowLeft, ClipboardCheck, CloudRain } from 'lucide-react';
import type { EstimateScheduleTaskBaseline } from '../../application/estimateScheduleBaseline';
import {
  calculateGanttBarPositionForScale,
  formatGanttDurationLabel,
  getGanttBaselineBarClassName,
  getGanttCriticalBarClassName,
  isGanttTaskOnCriticalPath,
  type GanttRow,
  type GanttScaledTimeline,
} from '../estimateGanttDisplay';
import { formatEstimateBlank } from '../estimateFormatters';
import { BADGE_BASE, BADGE_INFO, BADGE_WARNING } from '../../../../theme/statusColors';
import { PLANNER_MUTED, TEXT_BODY, TEXT_FOREGROUND } from '../estimateWorkspaceTheme';

interface Props {
  row: GanttRow;
  timeline: GanttScaledTimeline;
  todayMarkerLeft?: number | null;
  criticalTaskIds?: string[];
  showCriticalPath?: boolean;
  baselineTask?: EstimateScheduleTaskBaseline;
  showBaseline?: boolean;
}

const ROW_HEIGHT_BY_KIND = {
  division: 'h-9',
  scope: 'h-8',
  task: 'h-11',
} as const;

export default function EstimateGanttRow({
  row,
  timeline,
  todayMarkerLeft = null,
  criticalTaskIds = [],
  showCriticalPath = false,
  baselineTask,
  showBaseline = false,
}: Props) {
  const columnWidth = timeline.columnWidth;
  const barPosition =
    row.kind === 'task' && row.task
      ? calculateGanttBarPositionForScale(row.task, timeline)
      : null;
  const baselineBarPosition =
    showBaseline && baselineTask
      ? calculateGanttBarPositionForScale(
          {
            plannedStartDate: baselineTask.baselineStartDate,
            plannedEndDate: baselineTask.baselineEndDate,
            durationDays: baselineTask.durationDays,
          },
          timeline,
        )
      : null;
  const isCritical = isGanttTaskOnCriticalPath(
    row.task?.candidateId,
    criticalTaskIds,
    showCriticalPath,
  );

  const indentClass =
    row.indentLevel === 0 ? 'pl-2' : row.indentLevel === 1 ? 'pl-4' : 'pl-6';

  const labelClass =
    row.kind === 'division'
      ? `text-xs font-semibold uppercase tracking-wide ${TEXT_FOREGROUND}`
      : row.kind === 'scope'
        ? `text-xs font-medium ${TEXT_BODY}`
        : `text-sm ${TEXT_BODY}`;

  return (
    <div className="flex" role="row">
      <div
        className={`sticky left-0 z-10 flex w-44 shrink-0 items-center border-b border-r border-slate-200 bg-white/95 px-2 dark:border-slate-700 dark:bg-slate-900/95 sm:w-56 ${ROW_HEIGHT_BY_KIND[row.kind]}`}
        role="rowheader"
      >
        <div className={`min-w-0 flex-1 truncate ${indentClass} ${labelClass}`}>
          {formatEstimateBlank(row.label)}
        </div>
        {row.kind === 'task' && row.task ? (
          <div className="ml-1 flex shrink-0 items-center gap-1">
            {row.hasFinishToStartPredecessor ? (
              <span
                className={`${BADGE_BASE} border border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300`}
                title="Has finish-to-start predecessor in preview"
                aria-label="Has finish-to-start predecessor in preview"
              >
                <ArrowLeft className="h-3 w-3" />
              </span>
            ) : null}
            {row.task.weatherSensitive ? (
              <span
                className={`${BADGE_BASE} ${BADGE_WARNING}`}
                title="Weather sensitive"
                aria-label="Weather sensitive"
              >
                <CloudRain className="h-3 w-3" />
              </span>
            ) : null}
            {row.task.inspectionRequired ? (
              <span
                className={`${BADGE_BASE} ${BADGE_INFO}`}
                title="Inspection required"
                aria-label="Inspection required"
              >
                <ClipboardCheck className="h-3 w-3" />
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className={`relative flex-1 border-b border-slate-200 dark:border-slate-700 ${ROW_HEIGHT_BY_KIND[row.kind]}`}
        style={{ width: timeline.totalWidthPx }}
        role="gridcell"
      >
        {timeline.buckets.map((bucket, index) => (
          <div
            key={`${row.id}:${bucket.key}`}
            className="absolute top-0 h-full border-r border-slate-100 dark:border-slate-800/80"
            style={{
              left: index * columnWidth,
              width: columnWidth,
            }}
            aria-hidden
          />
        ))}

        {todayMarkerLeft != null ? (
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-rose-500/80 dark:bg-rose-400/80"
            style={{ left: todayMarkerLeft }}
            aria-hidden
          />
        ) : null}

        {baselineBarPosition ? (
          <div
            className={`absolute top-7 z-0 rounded-md px-1 py-0.5 ${getGanttBaselineBarClassName()}`}
            style={{
              left: baselineBarPosition.leftPx,
              width: Math.max(baselineBarPosition.widthPx - 2, columnWidth - 2),
              minWidth: columnWidth - 2,
              height: '0.75rem',
            }}
            title={`Baseline ${baselineTask?.baselineStartDate} – ${baselineTask?.baselineEndDate}`}
            aria-hidden
          />
        ) : null}

        {barPosition ? (
          <div
            className={`absolute top-1.5 z-[1] rounded-md border px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm ${getGanttCriticalBarClassName(isCritical)}`}
            style={{
              left: barPosition.leftPx,
              width: Math.max(barPosition.widthPx - 2, columnWidth - 2),
              minWidth: columnWidth - 2,
            }}
            title={`${row.task?.plannedStartDate} – ${row.task?.plannedEndDate}`}
          >
            {barPosition.showDurationLabel && row.task ? (
              <span className="truncate">
                {formatGanttDurationLabel(row.task.durationDays)}
              </span>
            ) : (
              <span className="sr-only">
                {row.task ? formatGanttDurationLabel(row.task.durationDays) : 'Activity bar'}
              </span>
            )}
          </div>
        ) : null}

        {row.kind !== 'task' ? (
          <div className={`absolute inset-0 ${PLANNER_MUTED} opacity-40`} aria-hidden />
        ) : null}
      </div>
    </div>
  );
}
