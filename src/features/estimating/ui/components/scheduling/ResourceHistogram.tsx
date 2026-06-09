import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ResourceHistogramDay } from '../../../scheduling/cpmTypes';
import {
  buildResourceHistogramTooltipContent,
  clampResourceHistogramTooltipPosition,
  computeResourceHistogramBarSegments,
  RESOURCE_HISTOGRAM_AVAILABLE_CREW_LABEL,
  RESOURCE_HISTOGRAM_BAR_MAX_HEIGHT,
  RESOURCE_HISTOGRAM_HELPER_TEXT,
  RESOURCE_HISTOGRAM_LEGEND_CRITICAL,
  RESOURCE_HISTOGRAM_LEGEND_NONCRITICAL,
  RESOURCE_HISTOGRAM_LEGEND_OVERALLOCATED,
  RESOURCE_HISTOGRAM_SUMMARY_DAYS_OVER,
  RESOURCE_HISTOGRAM_SUMMARY_PEAK_CRITICAL,
  RESOURCE_HISTOGRAM_SUMMARY_PEAK_REQUIRED,
  RESOURCE_HISTOGRAM_TITLE,
  RESOURCE_HISTOGRAM_TOOLTIP_CLASS,
  RESOURCE_HISTOGRAM_X_AXIS_LABEL,
  RESOURCE_HISTOGRAM_Y_AXIS_LABEL,
} from './resourceHistogramUi';

interface Props {
  histogram: ResourceHistogramDay[];
  projectDurationDays: number;
}

interface TooltipState {
  day: ResourceHistogramDay;
  left: number;
  top: number;
}

const TOOLTIP_WIDTH = 288;
const TOOLTIP_HEIGHT = 240;

function ResourceHistogramTooltip({ day, left, top }: TooltipState) {
  const content = buildResourceHistogramTooltipContent(day);

  return (
    <div
      role="tooltip"
      data-testid="resource-histogram-tooltip"
      className={`pointer-events-none fixed z-[70] w-72 max-w-[calc(100vw-1rem)] ${RESOURCE_HISTOGRAM_TOOLTIP_CLASS}`}
      style={{ left, top }}
    >
      <p className="text-sm font-semibold">Project Day {content.projectDay}</p>
      <p className="mt-1 text-slate-600 dark:text-slate-300">Date: {content.calendarDate}</p>
      <dl className="mt-2 space-y-1">
        <div className="flex justify-between gap-3">
          <dt>Available crew</dt>
          <dd className="tabular-nums font-medium">{content.availableCrew}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Required crew</dt>
          <dd className="tabular-nums font-medium">{content.requiredCrew}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Overallocated by</dt>
          <dd className="tabular-nums font-medium">{content.overallocatedBy}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Critical crew</dt>
          <dd className="tabular-nums font-medium">{content.criticalCrew}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Noncritical crew</dt>
          <dd className="tabular-nums font-medium">{content.noncriticalCrew}</dd>
        </div>
      </dl>
      <p className="mt-2 font-medium">Active activities ({content.activeActivityCount})</p>
      {content.activityLines.length > 0 ? (
        <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto">
          {content.activityLines.map((line) => (
            <li key={line} className="text-slate-700 dark:text-slate-200">
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-slate-600 dark:text-slate-300">No activities scheduled this day.</p>
      )}
    </div>
  );
}

export default function ResourceHistogram({ histogram, projectDurationDays }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [focusedDayOffset, setFocusedDayOffset] = useState<number | null>(null);

  const maxRequired = useMemo(
    () =>
      histogram.length === 0
        ? 1
        : Math.max(
            1,
            ...histogram.map((day) => day.requiredCrew),
            ...histogram.map((day) => day.availableCrew),
          ),
    [histogram],
  );

  const overallocatedDayCount = histogram.filter((day) => day.isOverallocated).length;
  const availableCrew = histogram[0]?.availableCrew ?? 0;
  const peakRequired =
    histogram.length > 0 ? Math.max(...histogram.map((day) => day.requiredCrew)) : 0;
  const peakCritical =
    histogram.length > 0 ? Math.max(...histogram.map((day) => day.criticalRequiredCrew)) : 0;
  const yAxisTicks = useMemo(
    () => [maxRequired, Math.round(maxRequired / 2), 0],
    [maxRequired],
  );
  const availableLineFromBottomPx = Math.round(
    (availableCrew / maxRequired) * RESOURCE_HISTOGRAM_BAR_MAX_HEIGHT,
  );

  const showTooltipForDay = useCallback((day: ResourceHistogramDay, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const position = clampResourceHistogramTooltipPosition(
      rect,
      TOOLTIP_WIDTH,
      TOOLTIP_HEIGHT,
      window.innerWidth,
      window.innerHeight,
    );
    setTooltip({ day, ...position });
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltip(null);
    setFocusedDayOffset(null);
  }, []);

  useEffect(() => {
    if (focusedDayOffset === null) return undefined;

    const active = document.querySelector<HTMLElement>(
      `[data-histogram-day="${focusedDayOffset}"]`,
    );
    const day = histogram.find((entry) => entry.dayOffset === focusedDayOffset);
    if (!active || !day) return undefined;

    const reposition = () => showTooltipForDay(day, active);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [focusedDayOffset, histogram, showTooltipForDay]);

  if (histogram.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            className="text-sm font-semibold text-slate-800 dark:text-slate-200"
            data-testid="resource-histogram-title"
          >
            {RESOURCE_HISTOGRAM_TITLE}
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-slate-600 dark:text-slate-400">
            {RESOURCE_HISTOGRAM_HELPER_TEXT}
          </p>
        </div>
        <div
          className="flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-300"
          data-testid="resource-histogram-legend"
        >
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded bg-amber-400 dark:bg-amber-500" />
            {RESOURCE_HISTOGRAM_LEGEND_NONCRITICAL}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded bg-cyan-500 dark:bg-cyan-600" />
            {RESOURCE_HISTOGRAM_LEGEND_CRITICAL}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded bg-red-500 dark:bg-red-600" />
            {RESOURCE_HISTOGRAM_LEGEND_OVERALLOCATED}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-red-500 dark:border-red-400" />
            {RESOURCE_HISTOGRAM_AVAILABLE_CREW_LABEL}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">{RESOURCE_HISTOGRAM_SUMMARY_PEAK_REQUIRED}</p>
          <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{peakRequired}</p>
        </div>
        <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">{RESOURCE_HISTOGRAM_SUMMARY_PEAK_CRITICAL}</p>
          <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{peakCritical}</p>
        </div>
        <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">{RESOURCE_HISTOGRAM_AVAILABLE_CREW_LABEL}</p>
          <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{availableCrew}</p>
        </div>
        <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">{RESOURCE_HISTOGRAM_SUMMARY_DAYS_OVER}</p>
          <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {overallocatedDayCount}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <div className="flex min-w-[420px]">
            <div className="flex w-12 shrink-0 flex-col justify-between py-4 pr-2 text-right text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
              <span>{yAxisTicks[0]}</span>
              <span>{yAxisTicks[1]}</span>
              <span>{yAxisTicks[2]}</span>
            </div>
            <div className="relative flex min-w-0 flex-1 flex-col">
              <div
                className="relative flex items-end gap-px px-3 pb-1 pt-4"
                style={{ minWidth: Math.max(360, projectDurationDays * 10) }}
                data-testid="resource-histogram-chart"
              >
                <div
                  className="pointer-events-none absolute left-3 right-3 border-t-2 border-dashed border-red-500 dark:border-red-400"
                  style={{ bottom: `${availableLineFromBottomPx + 12}px` }}
                  data-testid="resource-histogram-available-line"
                >
                  <span className="absolute -top-4 right-0 text-[10px] font-medium text-red-600 dark:text-red-300">
                    {RESOURCE_HISTOGRAM_AVAILABLE_CREW_LABEL}
                  </span>
                </div>

                {histogram.map((day) => {
                  const segments = computeResourceHistogramBarSegments(day, maxRequired);

                  return (
                    <button
                      key={day.dayOffset}
                      type="button"
                      data-testid={`resource-histogram-bar-${day.dayOffset}`}
                      data-histogram-day={day.dayOffset}
                      aria-describedby={tooltip?.day.dayOffset === day.dayOffset ? 'resource-histogram-tooltip' : undefined}
                      aria-label={`Project day ${day.dayOffset}, required crew ${day.requiredCrew}`}
                      className="relative flex min-w-[8px] flex-1 flex-col items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                      style={{ height: RESOURCE_HISTOGRAM_BAR_MAX_HEIGHT + 12 }}
                      onMouseEnter={(event) => {
                        setFocusedDayOffset(day.dayOffset);
                        showTooltipForDay(day, event.currentTarget);
                      }}
                      onMouseLeave={hideTooltip}
                      onFocus={(event) => {
                        setFocusedDayOffset(day.dayOffset);
                        showTooltipForDay(day, event.currentTarget);
                      }}
                      onBlur={hideTooltip}
                    >
                      <div
                        className="relative mt-auto flex w-full flex-col justify-end"
                        style={{ height: RESOURCE_HISTOGRAM_BAR_MAX_HEIGHT }}
                      >
                        {segments.overallocatedHeightPx > 0 ? (
                          <div
                            className="w-full rounded-t bg-red-500 dark:bg-red-600"
                            style={{ height: segments.overallocatedHeightPx }}
                          />
                        ) : null}
                        {segments.criticalWithinLimitHeightPx > 0 ? (
                          <div
                            className="w-full bg-cyan-500 dark:bg-cyan-600"
                            style={{ height: segments.criticalWithinLimitHeightPx }}
                          />
                        ) : null}
                        {segments.noncriticalHeightPx > 0 ? (
                          <div
                            className="w-full rounded-b bg-amber-400 dark:bg-amber-500"
                            style={{ height: segments.noncriticalHeightPx }}
                          />
                        ) : null}
                        {segments.totalHeightPx === 0 ? (
                          <div className="h-0.5 w-full rounded bg-slate-300 dark:bg-slate-700" />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div
                className="flex items-center gap-px px-3 pb-2"
                style={{ minWidth: Math.max(360, projectDurationDays * 10) }}
                data-testid="resource-histogram-x-axis"
              >
                {histogram.map((day) => (
                  <div
                    key={day.dayOffset}
                    className="min-w-[8px] flex-1 text-center text-[10px] tabular-nums text-slate-500 dark:text-slate-400"
                  >
                    {day.dayOffset % 5 === 0 ? day.dayOffset : ''}
                  </div>
                ))}
              </div>
              <p
                className="px-3 pb-3 text-center text-xs font-medium text-slate-600 dark:text-slate-300"
                data-testid="resource-histogram-x-axis-label"
              >
                {RESOURCE_HISTOGRAM_X_AXIS_LABEL}
              </p>
            </div>
          </div>
          <p
            className="-mt-1 pb-3 pl-14 text-xs font-medium text-slate-600 dark:text-slate-300"
            data-testid="resource-histogram-y-axis-label"
          >
            {RESOURCE_HISTOGRAM_Y_AXIS_LABEL}
          </p>
        </div>
      </div>

      {tooltip && typeof document !== 'undefined'
        ? createPortal(<ResourceHistogramTooltip {...tooltip} />, document.body)
        : null}
    </div>
  );
}
