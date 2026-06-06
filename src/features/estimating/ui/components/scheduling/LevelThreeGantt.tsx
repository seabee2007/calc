import { forwardRef, useMemo } from 'react';
import type { ScheduleActivity } from '../../../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type { CpmResult, ScheduleSettings } from '../../../scheduling/cpmTypes';
import {
  LEVEL_THREE_DAY_COL_WIDTH_PX,
  buildTimelineDays,
  buildTimelineMonthSegments,
  getLevelThreeGanttRows,
  resolveGanttCellKind,
} from '../../../scheduling/levelThreeGanttUtils';
import Button from '../../../../../components/ui/Button';

const COL_CODE = 'w-24 shrink-0';
const COL_DESC = 'w-48 shrink-0';
const COL_META = 'w-14 shrink-0 text-right tabular-nums';
const ROW_HEIGHT = 36;

function formatDateShort(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  return `${match[2]}/${match[3]}`;
}

interface Props {
  activities: ScheduleActivity[];
  cpmResult: CpmResult | null;
  scheduleSettings: ScheduleSettings;
  leveledOffsets?: Record<string, number>;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  exportReady?: boolean;
}

function GanttBarCells({
  row,
  projectDuration,
  timelineWidth,
}: {
  row: ReturnType<typeof getLevelThreeGanttRows>[number];
  projectDuration: number;
  timelineWidth: number;
}) {
  const es = row.cpm.earlyStart + row.leveledOffset;
  const duration = row.activity.durationDays;
  const tf = Math.max(0, row.cpm.totalFloat - row.leveledOffset);
  const barColor = row.cpm.isCritical
    ? 'bg-red-500 dark:bg-red-600'
    : 'bg-cyan-500 dark:bg-cyan-600';

  const leftPx = es * LEVEL_THREE_DAY_COL_WIDTH_PX;
  const widthPx = duration * LEVEL_THREE_DAY_COL_WIDTH_PX;
  const floatWidthPx = tf * LEVEL_THREE_DAY_COL_WIDTH_PX;

  return (
    <div
      className="relative h-full"
      style={{ width: timelineWidth, minWidth: timelineWidth }}
    >
      <div
        className={`absolute top-1/2 h-5 -translate-y-1/2 rounded ${barColor}`}
        style={{ left: leftPx, width: Math.max(4, widthPx) }}
        title={`${row.activity.activityDescription}: ${duration}d`}
      />
      {tf > 0 && (
        <div
          className="absolute top-1/2 h-5 -translate-y-1/2 rounded border-2 border-dashed border-slate-400 bg-transparent dark:border-slate-500"
          style={{ left: leftPx + widthPx, width: Math.max(4, floatWidthPx) }}
          title={`Float: ${tf}d`}
        />
      )}
    </div>
  );
}

const LevelThreeGantt = forwardRef<HTMLDivElement, Props>(function LevelThreeGantt(
  {
    activities,
    cpmResult,
    scheduleSettings,
    leveledOffsets = {},
    onExportPdf,
    onExportExcel,
    exportReady = false,
  },
  ref,
) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const projectStartDate = scheduleSettings.projectStartDate || today;

  const rows = useMemo(() => {
    if (!cpmResult || cpmResult.activities.length === 0) return [];
    return getLevelThreeGanttRows(activities, cpmResult, projectStartDate, leveledOffsets);
  }, [activities, cpmResult, projectStartDate, leveledOffsets]);

  const projectDuration = Math.max(cpmResult?.projectDurationDays ?? 0, 1);
  const timelineDays = useMemo(
    () => buildTimelineDays(projectStartDate, projectDuration),
    [projectStartDate, projectDuration],
  );
  const monthSegments = useMemo(
    () => buildTimelineMonthSegments(timelineDays),
    [timelineDays],
  );
  const timelineWidth = projectDuration * LEVEL_THREE_DAY_COL_WIDTH_PX;

  const todayOffset = useMemo(() => {
    if (!projectStartDate) return null;
    const startMs = Date.parse(`${projectStartDate}T00:00:00Z`);
    const todayMs = Date.parse(`${today}T00:00:00Z`);
    const offset = Math.round((todayMs - startMs) / 86_400_000);
    if (offset < 0 || offset >= projectDuration) return null;
    return offset;
  }, [projectStartDate, today, projectDuration]);

  if (!cpmResult || rows.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-20 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        No scheduled activities. Add activities in the Estimate tab, then wire them in Logic Network.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Level III Gantt
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Activities sorted by early start · {rows.length} activities · {projectDuration} days
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!exportReady}
            title={!exportReady ? 'Run CPM before exporting.' : undefined}
            onClick={onExportPdf}
          >
            Export PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!exportReady}
            title={!exportReady ? 'Run CPM before exporting.' : undefined}
            onClick={onExportExcel}
          >
            Export Excel
          </Button>
        </div>
      </div>

      <div
        ref={ref}
        data-level-three-gantt-export
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="overflow-x-auto">
          {/* Column labels row */}
          <div className="flex border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex shrink-0 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span className={COL_CODE}>Code</span>
              <span className={`${COL_DESC} px-2`}>Description</span>
              <span className={COL_META}>Float</span>
              <span className={COL_META}>Dur</span>
              <span className={COL_META}>Start</span>
              <span className={`${COL_META} mr-2`}>Finish</span>
            </div>
            <div
              className="relative shrink-0"
              style={{ width: timelineWidth, minWidth: timelineWidth }}
            >
              {/* Month row */}
              <div className="flex h-5 border-b border-slate-200 dark:border-slate-700">
                {monthSegments.map((segment) => (
                  <div
                    key={`${segment.monthLabel}-${segment.startDayOffset}`}
                    className="border-r border-slate-200 px-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400"
                    style={{ width: segment.dayCount * LEVEL_THREE_DAY_COL_WIDTH_PX }}
                  >
                    {segment.monthLabel}
                  </div>
                ))}
              </div>
              {/* Day number row */}
              <div className="flex h-5">
                {timelineDays.map((day) => (
                  <div
                    key={day.dayOffset}
                    className="border-r border-slate-100 text-center text-[10px] tabular-nums text-slate-400 dark:border-slate-800 dark:text-slate-500"
                    style={{ width: LEVEL_THREE_DAY_COL_WIDTH_PX }}
                  >
                    {day.dayOfMonth}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activity rows */}
          {rows.map((row) => (
            <div
              key={row.activity.activityCode}
              className="flex items-center border-b border-slate-100 px-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
              style={{ height: ROW_HEIGHT }}
            >
              <span
                className={`${COL_CODE} font-mono text-xs font-medium ${
                  row.cpm.isCritical
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {row.activity.activityCode}
              </span>
              <span
                className={`${COL_DESC} truncate px-2 text-xs text-slate-800 dark:text-slate-100`}
                title={row.activity.activityDescription}
              >
                {row.activity.activityDescription}
              </span>
              <span className={`${COL_META} text-xs text-slate-600 dark:text-slate-400`}>
                {row.cpm.totalFloat}d
              </span>
              <span className={`${COL_META} text-xs text-slate-600 dark:text-slate-400`}>
                {row.activity.durationDays}d
              </span>
              <span className={`${COL_META} text-xs text-slate-500`}>
                {formatDateShort(row.plannedStart)}
              </span>
              <span className={`${COL_META} mr-2 text-xs text-slate-500`}>
                {formatDateShort(row.plannedFinish)}
              </span>

              <div
                className="relative shrink-0"
                style={{ height: ROW_HEIGHT, width: timelineWidth, minWidth: timelineWidth }}
              >
                {todayOffset !== null && (
                  <div
                    className="absolute top-0 bottom-0 z-10 w-px bg-blue-500 opacity-60"
                    style={{ left: todayOffset * LEVEL_THREE_DAY_COL_WIDTH_PX }}
                    title="Today"
                  />
                )}
                <GanttBarCells
                  row={row}
                  projectDuration={projectDuration}
                  timelineWidth={timelineWidth}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-8 rounded bg-red-500" />
          Critical path
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-8 rounded bg-cyan-500" />
          Noncritical
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-8 rounded border-2 border-dashed border-slate-400" />
          Total float
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5 bg-blue-500" />
          Today
        </span>
      </div>
    </div>
  );
});

export default LevelThreeGantt;
export { resolveGanttCellKind };
