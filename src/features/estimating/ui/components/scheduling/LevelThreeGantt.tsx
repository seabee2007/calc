import { forwardRef, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { ScheduleActivity } from '../../../scheduling/adapters/estimateLineItemsToScheduleActivities';
import { resolveSelectedGanttActivityDetails } from '../../../scheduling/activityDetailsModalData';
import type { CpmLogicLink, CpmResult, ScheduleSettings } from '../../../scheduling/cpmTypes';
import {
  DAY_WIDTH,
  DEFAULT_PIXELS_PER_DAY,
  GANTT_LEFT_TABLE_REGION_ATTR,
  GANTT_TIMELINE_REGION_ATTR,
  HEADER_DAY_HEIGHT,
  HEADER_MONTH_HEIGHT,
  FLOAT_COLUMN_CELL_BORDER_STYLE,
  FLOAT_COLUMN_CLASS,
  FLOAT_COLUMN_HEADER_BORDER_STYLE,
  LEFT_TABLE_HEADERS,
  LEFT_TABLE_WIDTH,
  ROW_HEIGHT,
  assertGanttGridInvariants,
  computeActivityBarLayout,
  computeTodayDayOffset,
  getLocalDateYmd,
  dayCellLeftPx,
  dayCellWidthPx,
  formatEstimatedFloat,
  leftTableGridTemplateColumns,
  monthSegmentWidthPx,
  timelineWidthPx,
  todayLineLeftPx,
} from '../../../scheduling/levelThreeGanttGrid';
import { isDisplayCritical } from '../../../scheduling/cpm/cpmDisplayCritical';
import {
  buildTimelineDays,
  buildTimelineMonthSegments,
  getLevelThreeGanttRows,
  resolveGanttRowCodeClassName,
} from '../../../scheduling/levelThreeGanttUtils';
import type { EstimateDomainTask } from '../../../infrastructure/estimateDbTypes';
import Button from '../../../../../components/ui/Button';
import ActivityDetailsModal from './ActivityDetailsModal';

interface Props {
  activities: ScheduleActivity[];
  cpmResult: CpmResult | null;
  scheduleSettings: ScheduleSettings;
  leveledOffsets?: Record<string, number>;
  logicLinks?: CpmLogicLink[];
  lineItems?: EstimateDomainTask[];
  onEditActivity?: (activityCode: string) => void;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  exportReady?: boolean;
  fullscreen?: boolean;
  chromeless?: boolean;
  /** Pixels per calendar day — drives zoom level. Defaults to DEFAULT_PIXELS_PER_DAY. */
  pixelsPerDay?: number;
  /** Ref forwarded to the inner horizontal-scroll container (for Fit Project / Today scroll). */
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}

function TimelineGridlines({
  dayCount,
  pixelsPerDay,
}: {
  dayCount: number;
  pixelsPerDay: number;
}) {
  return (
    <>
      {Array.from({ length: dayCount + 1 }, (_, dayOffset) => (
        <div
          key={dayOffset}
          className="absolute top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700"
          style={{ left: dayCellLeftPx(dayOffset, pixelsPerDay) }}
        />
      ))}
    </>
  );
}

function TodayLine({
  todayOffset,
  height,
  pixelsPerDay,
}: {
  todayOffset: number;
  height: number | '100%';
  pixelsPerDay: number;
}) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-20"
      style={{
        left: todayLineLeftPx(todayOffset, pixelsPerDay),
        width: 2,
        height,
        backgroundColor: 'rgba(6, 182, 212, 0.75)',
      }}
      title="Today"
    />
  );
}

function ActivityBars({
  layout,
  isCritical,
  activityCode,
  onBarClick,
}: {
  layout: ReturnType<typeof computeActivityBarLayout>;
  isCritical: boolean;
  activityCode: string;
  onBarClick: (activityCode: string) => void;
}) {
  const barColor = isCritical
    ? 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500'
    : 'bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-500';

  const barTop = (ROW_HEIGHT - 20) / 2;

  function handleActivate() {
    onBarClick(activityCode);
  }

  return (
    <>
      <button
        type="button"
        className={`absolute cursor-pointer rounded ${barColor}`}
        style={{
          top: barTop,
          height: 20,
          left: layout.barLeft,
          width: layout.barWidth,
        }}
        title={`ES ${layout.earlyStart} · ${layout.earlyFinish - layout.earlyStart}d — click for details`}
        onClick={handleActivate}
      />
      {layout.floatWidth > 0 && (
        <button
          type="button"
          className="absolute cursor-pointer rounded border-2 border-dashed border-slate-500 bg-transparent hover:border-slate-600 dark:border-slate-500 dark:hover:border-slate-400"
          style={{
            top: barTop,
            height: 20,
            left: layout.floatLeft,
            width: layout.floatWidth,
          }}
          title={`Float ${layout.totalFloat}d — click for details`}
          onClick={handleActivate}
        />
      )}
    </>
  );
}

const LevelThreeGantt = forwardRef<HTMLDivElement, Props>(function LevelThreeGantt(
  {
    activities,
    cpmResult,
    scheduleSettings,
    leveledOffsets = {},
    logicLinks = [],
    lineItems = [],
    onEditActivity,
    onExportPdf,
    onExportExcel,
    exportReady = false,
    fullscreen = false,
    chromeless = false,
    pixelsPerDay = DEFAULT_PIXELS_PER_DAY,
    scrollContainerRef: externalScrollRef,
  },
  ref,
) {
  const [selectedActivityCode, setSelectedActivityCode] = useState<string | null>(null);
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = externalScrollRef ?? internalScrollRef;
  const today = useMemo(() => getLocalDateYmd(), []);
  const projectStartDate = scheduleSettings.projectStartDate || today;

  const rows = useMemo(() => {
    if (!cpmResult || cpmResult.activities.length === 0) return [];
    return getLevelThreeGanttRows(activities, cpmResult, projectStartDate, leveledOffsets);
  }, [activities, cpmResult, projectStartDate, leveledOffsets]);

  const projectDuration = Math.max(cpmResult?.projectDurationDays ?? 0, 1);
  const timelineWidth = timelineWidthPx(projectDuration, pixelsPerDay);
  const gridTemplate = leftTableGridTemplateColumns();

  const timelineDays = useMemo(
    () => buildTimelineDays(projectStartDate, projectDuration, today),
    [projectStartDate, projectDuration, today],
  );
  const monthSegments = useMemo(
    () => buildTimelineMonthSegments(timelineDays),
    [timelineDays],
  );

  const barLayouts = useMemo(
    () => rows.map((row) => computeActivityBarLayout(row, pixelsPerDay)),
    [rows, pixelsPerDay],
  );

  const todayOffset = useMemo(
    () => computeTodayDayOffset(projectStartDate, today, projectDuration),
    [projectStartDate, today, projectDuration],
  );

  const selectedDetails = useMemo(
    () =>
      resolveSelectedGanttActivityDetails(
        selectedActivityCode,
        rows,
        logicLinks,
        lineItems,
        cpmResult,
      ),
    [cpmResult, selectedActivityCode, rows, lineItems, logicLinks],
  );

  useEffect(() => {
    assertGanttGridInvariants(projectDuration, timelineWidth, rows.length, barLayouts, pixelsPerDay);
  }, [projectDuration, timelineWidth, rows.length, barLayouts, pixelsPerDay]);

  if (activities.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-20 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        No scheduled activities. Add activities in the Estimate tab, then wire them in Logic Network.
      </div>
    );
  }

  if (!cpmResult?.hasRunCpm || rows.length === 0) {
    return (
      <div className="space-y-3">
        {!chromeless ? (
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Level III Gantt
            </h2>
            <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">
              Draft schedule only. Run CPM from a valid precedence diagram before viewing the Level III
              Gantt timeline.
            </p>
          </div>
        ) : null}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Scheduled activities ({activities.length})
          </p>
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {activities.map((activity) => (
              <li key={activity.activityCode}>
                {activity.activityCode} · {activity.activityDescription} · {activity.durationDays}d
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const headerTimelineHeight = HEADER_MONTH_HEIGHT + HEADER_DAY_HEIGHT;

  return (
    <div className={fullscreen ? 'flex h-full min-h-0 w-full flex-col gap-3' : 'space-y-3'}>
      {!chromeless ? (
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
      ) : null}

      <div
        ref={ref}
        data-level-three-gantt-export
        className={
          fullscreen
            ? 'flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-slate-900'
            : 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'
        }
      >
        <div
          ref={scrollRef}
          className={fullscreen ? 'min-h-0 flex-1 overflow-auto' : 'overflow-x-auto'}
        >
          <div style={{ minWidth: LEFT_TABLE_WIDTH + timelineWidth }}>
            <div className="flex border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              <div
                {...{ [GANTT_LEFT_TABLE_REGION_ATTR]: true }}
                className="sticky left-0 z-20 shrink-0 overflow-hidden bg-slate-50 dark:bg-slate-800"
                style={{ width: LEFT_TABLE_WIDTH, height: headerTimelineHeight }}
              >
                <div
                  className="grid h-full text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <span className="flex items-end truncate px-2 pb-2">CODE</span>
                  <span className="flex items-end truncate px-2 pb-2">DESCRIPTION</span>
                  <span
                    className={`${FLOAT_COLUMN_CLASS} text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400`}
                    style={FLOAT_COLUMN_HEADER_BORDER_STYLE}
                  >
                    {LEFT_TABLE_HEADERS[2]}
                  </span>
                </div>
              </div>

              <div
                {...{ [GANTT_TIMELINE_REGION_ATTR]: true }}
                className="relative shrink-0 overflow-hidden"
                style={{ width: timelineWidth, height: headerTimelineHeight }}
              >
                <div
                  className="relative border-b border-slate-200 dark:border-slate-700"
                  style={{ height: HEADER_MONTH_HEIGHT, width: timelineWidth }}
                >
                  {monthSegments.map((segment) => (
                    <div
                      key={`${segment.monthLabel}-${segment.startDayOffset}`}
                      className="absolute top-0 flex items-center justify-center border-r border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-400"
                      style={{
                        left: dayCellLeftPx(segment.startDayOffset, pixelsPerDay),
                        width: monthSegmentWidthPx(segment.dayCount, pixelsPerDay),
                        height: HEADER_MONTH_HEIGHT,
                      }}
                    >
                      {segment.monthLabel}
                    </div>
                  ))}
                </div>
                <div
                  className="relative"
                  style={{ height: HEADER_DAY_HEIGHT, width: timelineWidth }}
                >
                  {timelineDays.map((day) => (
                    <div
                      key={day.dayOffset}
                      className={`absolute top-0 flex items-center justify-center border-r border-slate-200 text-[10px] tabular-nums dark:border-slate-700 ${
                        day.isToday
                          ? 'font-semibold text-cyan-600 dark:text-cyan-400'
                          : day.isWeekend
                            ? 'text-slate-400 dark:text-slate-600'
                            : 'text-slate-600 dark:text-slate-400'
                      }`}
                      style={{
                        left: dayCellLeftPx(day.dayOffset, pixelsPerDay),
                        width: dayCellWidthPx(pixelsPerDay),
                        height: HEADER_DAY_HEIGHT,
                      }}
                    >
                      {pixelsPerDay >= 14 ? day.dayOfMonth : null}
                    </div>
                  ))}
                </div>
                {todayOffset !== null && (
                  <TodayLine
                    todayOffset={todayOffset}
                    height={headerTimelineHeight}
                    pixelsPerDay={pixelsPerDay}
                  />
                )}
              </div>
            </div>

            {rows.map((row, rowIndex) => {
              const layout = barLayouts[rowIndex]!;
              return (
                <div
                  key={row.activity.activityCode}
                  className="flex border-b border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
                  style={{ height: ROW_HEIGHT }}
                >
                  <div
                    {...{ [GANTT_LEFT_TABLE_REGION_ATTR]: true }}
                    className="sticky left-0 z-10 shrink-0 overflow-hidden bg-white dark:bg-slate-900"
                    style={{ width: LEFT_TABLE_WIDTH, height: ROW_HEIGHT }}
                  >
                    <div
                      className="grid h-full items-center text-xs"
                      style={{ gridTemplateColumns: gridTemplate }}
                    >
                      <span
                        className={`truncate px-2 font-mono font-medium ${resolveGanttRowCodeClassName(row, cpmResult)}`}
                      >
                        {row.activity.activityCode}
                      </span>
                      <span
                        className="truncate px-2 text-slate-800 dark:text-slate-100"
                        title={row.activity.activityDescription}
                      >
                        {row.activity.activityDescription}
                      </span>
                      <span
                        className={`${FLOAT_COLUMN_CLASS} h-full text-slate-600 dark:text-slate-400`}
                        style={FLOAT_COLUMN_CELL_BORDER_STYLE}
                      >
                        {formatEstimatedFloat(row.cpm.totalFloat)}
                      </span>
                    </div>
                  </div>

                  <div
                    {...{ [GANTT_TIMELINE_REGION_ATTR]: true }}
                    className="relative shrink-0 overflow-hidden"
                    style={{ width: timelineWidth, height: ROW_HEIGHT }}
                  >
                    <TimelineGridlines dayCount={projectDuration} pixelsPerDay={pixelsPerDay} />
                    {todayOffset !== null && (
                      <TodayLine todayOffset={todayOffset} height="100%" pixelsPerDay={pixelsPerDay} />
                    )}
                    <ActivityBars
                      layout={layout}
                      isCritical={isDisplayCritical(cpmResult!, row.activity.activityCode)}
                      activityCode={row.activity.activityCode}
                      onBarClick={setSelectedActivityCode}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className={`flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400 ${
          fullscreen ? 'shrink-0 px-4 pb-3' : ''
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-8 rounded bg-red-500" />
          Critical path
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-8 rounded bg-cyan-500" />
          Noncritical
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-8 rounded border-2 border-dashed border-slate-500 dark:border-slate-400" />
          Estimated float
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-8 bg-cyan-500 dark:bg-cyan-400" />
          Today
        </span>
        <span className="text-slate-500 dark:text-slate-500">Click a bar to view activity details</span>
      </div>

      {selectedDetails && (
        <ActivityDetailsModal
          details={selectedDetails}
          onClose={() => setSelectedActivityCode(null)}
          onEdit={() => {
            const code = selectedDetails.activityCode;
            setSelectedActivityCode(null);
            onEditActivity?.(code);
          }}
        />
      )}
    </div>
  );
});

export default LevelThreeGantt;
