import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';
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
  RESOURCE_HISTOGRAM_PLOT_TOP_PADDING_PX,
  RESOURCE_HISTOGRAM_TITLE,
  RESOURCE_HISTOGRAM_TOOLTIP_CLASS,
  RESOURCE_HISTOGRAM_X_AXIS_LABEL,
  RESOURCE_HISTOGRAM_Y_AXIS_GUTTER_PX,
  RESOURCE_HISTOGRAM_Y_AXIS_LABEL,
} from './resourceHistogramUi';
import {
  computeResourceHistogramScale,
  crewValueToPlotRatio,
} from './resourceHistogramScale';

interface Props {
  histogram: ResourceHistogramDay[];
  projectDurationDays: number;
  onResourceLevel?: () => void;
  onClearLeveling?: () => void;
  showClearLeveling?: boolean;
}

interface TooltipState {
  day: ResourceHistogramDay;
  left: number;
  top: number;
}

const TOOLTIP_WIDTH = 288;
const TOOLTIP_HEIGHT = 240;

const METRIC_CHIP_CLASS =
  'inline-flex items-center rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] tabular-nums text-slate-700 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200';

const ACTION_BUTTON_CLASS =
  'rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

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

export default function ResourceHistogram({
  histogram,
  projectDurationDays,
  onResourceLevel,
  onClearLeveling,
  showClearLeveling = false,
}: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [focusedDayOffset, setFocusedDayOffset] = useState<number | null>(null);

  const overallocatedDayCount = histogram.filter((day) => day.isOverallocated).length;
  const availableCrew = histogram[0]?.availableCrew ?? 0;
  const peakRequired =
    histogram.length > 0 ? Math.max(...histogram.map((day) => day.requiredCrew)) : 0;
  const peakCritical =
    histogram.length > 0 ? Math.max(...histogram.map((day) => day.criticalRequiredCrew)) : 0;
  const { chartMax, yAxisTicks } = useMemo(
    () =>
      computeResourceHistogramScale({
        maxCrewDemand: peakRequired,
        availableCrew,
      }),
    [availableCrew, peakRequired],
  );
  const plotHeightPx = RESOURCE_HISTOGRAM_BAR_MAX_HEIGHT;
  const chartAreaHeightPx = plotHeightPx + RESOURCE_HISTOGRAM_PLOT_TOP_PADDING_PX;
  const availableLineRatio = crewValueToPlotRatio(availableCrew, chartMax);

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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3
            className="text-sm font-semibold text-slate-800 dark:text-slate-200"
            data-testid="resource-histogram-title"
          >
            {RESOURCE_HISTOGRAM_TITLE}
          </h3>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            title={RESOURCE_HISTOGRAM_HELPER_TEXT}
            aria-label={RESOURCE_HISTOGRAM_HELPER_TEXT}
          >
            <HelpCircle className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <div
          className="flex flex-wrap items-center gap-1.5"
          data-testid="resource-histogram-metrics"
        >
          <span className={METRIC_CHIP_CLASS} data-testid="resource-histogram-metric-peak">
            Peak {peakRequired}
          </span>
          <span className={METRIC_CHIP_CLASS} data-testid="resource-histogram-metric-critical">
            Critical {peakCritical}
          </span>
          <span className={METRIC_CHIP_CLASS} data-testid="resource-histogram-metric-available">
            Available {availableCrew}
          </span>
          <span className={METRIC_CHIP_CLASS} data-testid="resource-histogram-metric-over">
            Overallocated {overallocatedDayCount}d
          </span>
        </div>

        <div
          className="hidden flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400 md:flex"
          data-testid="resource-histogram-legend"
        >
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded bg-amber-400 dark:bg-amber-500" />
            {RESOURCE_HISTOGRAM_LEGEND_NONCRITICAL}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded bg-cyan-500 dark:bg-cyan-600" />
            {RESOURCE_HISTOGRAM_LEGEND_CRITICAL}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded bg-red-500 dark:bg-red-600" />
            {RESOURCE_HISTOGRAM_LEGEND_OVERALLOCATED}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-red-500 dark:border-red-400" />
            {RESOURCE_HISTOGRAM_AVAILABLE_CREW_LABEL}
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {onResourceLevel ? (
            <button
              type="button"
              className={ACTION_BUTTON_CLASS}
              data-testid="resource-histogram-level-button"
              onClick={onResourceLevel}
            >
              Resource level schedule
            </button>
          ) : null}
          {showClearLeveling && onClearLeveling ? (
            <button
              type="button"
              className="rounded-lg px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              data-testid="resource-histogram-clear-leveling-button"
              onClick={onClearLeveling}
            >
              Clear leveling
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div
          className="flex flex-wrap items-center justify-end gap-3 border-b border-slate-200 px-3 py-1.5 text-[11px] text-slate-600 dark:border-slate-700 dark:text-slate-400 md:hidden"
          data-testid="resource-histogram-legend-mobile"
        >
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded bg-amber-400 dark:bg-amber-500" />
            {RESOURCE_HISTOGRAM_LEGEND_NONCRITICAL}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded bg-cyan-500 dark:bg-cyan-600" />
            {RESOURCE_HISTOGRAM_LEGEND_CRITICAL}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded bg-red-500 dark:bg-red-600" />
            {RESOURCE_HISTOGRAM_LEGEND_OVERALLOCATED}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-red-500 dark:border-red-400" />
            {RESOURCE_HISTOGRAM_AVAILABLE_CREW_LABEL}
          </span>
        </div>
        <div className="overflow-x-auto">
          <div
            className="flex min-w-[420px]"
            style={{ paddingBottom: '0.25rem' }}
          >
            <div
              className="relative shrink-0"
              style={{
                width: RESOURCE_HISTOGRAM_Y_AXIS_GUTTER_PX,
                height: chartAreaHeightPx,
              }}
              data-testid="resource-histogram-y-axis"
            >
              <div
                className="absolute inset-x-0 bottom-0"
                style={{ height: plotHeightPx }}
              >
                {yAxisTicks.map((tick) => (
                  <span
                    key={tick}
                    className="absolute right-1 -translate-y-1/2 text-right text-[10px] tabular-nums leading-none text-slate-500 dark:text-slate-400"
                    style={{ bottom: `${crewValueToPlotRatio(tick, chartMax) * 100}%` }}
                    data-testid={`resource-histogram-y-axis-tick-${tick}`}
                  >
                    {tick}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative min-w-0 flex-1">
              <div
                className="relative px-3"
                style={{
                  height: chartAreaHeightPx,
                  minWidth: Math.max(360, projectDurationDays * 10),
                }}
              >
                <div
                  className="absolute inset-x-3 bottom-0"
                  style={{ height: plotHeightPx }}
                  data-testid="resource-histogram-chart"
                >
                  <div className="relative h-full">
                    {yAxisTicks.map((tick) => (
                      <div
                        key={`grid-${tick}`}
                        className={`pointer-events-none absolute left-0 right-0 ${
                          tick === 0
                            ? 'border-t border-slate-300 dark:border-slate-600'
                            : 'border-t border-slate-200 dark:border-slate-700/80'
                        }`}
                        style={{ bottom: `${crewValueToPlotRatio(tick, chartMax) * 100}%` }}
                        data-testid={
                          tick === 0
                            ? 'resource-histogram-baseline'
                            : `resource-histogram-grid-${tick}`
                        }
                      />
                    ))}

                    <div
                      className="pointer-events-none absolute left-0 right-0 border-t-2 border-dashed border-red-500 dark:border-red-400"
                      style={{ bottom: `${availableLineRatio * 100}%` }}
                      data-testid="resource-histogram-available-line"
                    >
                      <span className="absolute -top-3.5 right-0 whitespace-nowrap text-[10px] font-medium text-red-600 dark:text-red-300">
                        {RESOURCE_HISTOGRAM_AVAILABLE_CREW_LABEL}
                      </span>
                    </div>

                    <div className="absolute inset-0 flex items-end gap-px">
                      {histogram.map((day) => {
                        const segments = computeResourceHistogramBarSegments(
                          day,
                          chartMax,
                          plotHeightPx,
                        );

                        return (
                          <button
                            key={day.dayOffset}
                            type="button"
                            data-testid={`resource-histogram-bar-${day.dayOffset}`}
                            data-histogram-day={day.dayOffset}
                            aria-describedby={
                              tooltip?.day.dayOffset === day.dayOffset
                                ? 'resource-histogram-tooltip'
                                : undefined
                            }
                            aria-label={`Project day ${day.dayOffset}, required crew ${day.requiredCrew}`}
                            className="relative flex min-w-[8px] flex-1 flex-col items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
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
                            <div className="relative mt-auto flex h-full w-full flex-col justify-end">
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
                  </div>
                </div>
              </div>

              <div
                className="flex items-center gap-px px-3 pb-2 pt-1"
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
            className="pb-3 pl-3 text-xs font-medium text-slate-600 dark:text-slate-300"
            style={{ paddingLeft: RESOURCE_HISTOGRAM_Y_AXIS_GUTTER_PX + 12 }}
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
