import type { ResourceHistogramDay } from '../../scheduling/cpmTypes';

export const RESOURCE_HISTOGRAM_TITLE = 'Daily Crew Demand';
export const RESOURCE_HISTOGRAM_X_AXIS_LABEL = 'Project day';
export const RESOURCE_HISTOGRAM_Y_AXIS_LABEL = 'Crew required';
export const RESOURCE_HISTOGRAM_AVAILABLE_CREW_LABEL = 'Available crew';
export const RESOURCE_HISTOGRAM_LEGEND_NONCRITICAL = 'Noncritical crew';
export const RESOURCE_HISTOGRAM_LEGEND_CRITICAL = 'Critical crew';
export const RESOURCE_HISTOGRAM_LEGEND_OVERALLOCATED = 'Overallocated crew';
export const RESOURCE_HISTOGRAM_SUMMARY_PEAK_REQUIRED = 'Peak required crew per day';
export const RESOURCE_HISTOGRAM_SUMMARY_PEAK_CRITICAL = 'Peak critical crew';
export const RESOURCE_HISTOGRAM_SUMMARY_DAYS_OVER = 'Days over crew limit';
export const RESOURCE_HISTOGRAM_HELPER_TEXT =
  'Each histogram bar is one project day. Bar height equals total crew required by all activities active that day.';

export const RESOURCE_HISTOGRAM_TOOLTIP_CLASS =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

export const RESOURCE_HISTOGRAM_MIN_BAR_HEIGHT = 2;
export const RESOURCE_HISTOGRAM_BAR_MAX_HEIGHT = 80;
export const RESOURCE_HISTOGRAM_Y_AXIS_GUTTER_PX = 52;
export const RESOURCE_HISTOGRAM_PLOT_TOP_PADDING_PX = 4;

export interface ResourceHistogramBarSegments {
  totalHeightPx: number;
  noncriticalHeightPx: number;
  criticalWithinLimitHeightPx: number;
  overallocatedHeightPx: number;
  availableLineFromBottomPx: number;
}

export interface ResourceHistogramTooltipContent {
  projectDay: number;
  calendarDate: string;
  availableCrew: number;
  requiredCrew: number;
  overallocatedBy: number;
  criticalCrew: number;
  noncriticalCrew: number;
  activeActivityCount: number;
  activityLines: string[];
}

export function formatResourceHistogramCalendarDate(dateYmd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd.trim());
  if (!match) return dateYmd;

  const parsed = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

import { crewValueToPlotHeightPx } from './resourceHistogramScale';

export function computeResourceHistogramBarSegments(
  day: ResourceHistogramDay,
  chartMax: number,
  plotHeightPx: number = RESOURCE_HISTOGRAM_BAR_MAX_HEIGHT,
): ResourceHistogramBarSegments {
  const scalePx = (crew: number) =>
    crew <= 0 ? 0 : crewValueToPlotHeightPx(crew, chartMax, plotHeightPx);

  const totalHeightPx = Math.max(
    day.requiredCrew > 0 ? RESOURCE_HISTOGRAM_MIN_BAR_HEIGHT : 0,
    scalePx(day.requiredCrew),
  );
  const availableLineFromBottomPx = scalePx(day.availableCrew);
  const overallocatedHeightPx = scalePx(day.overallocatedAmount);
  const withinLimitCrew = Math.min(day.requiredCrew, day.availableCrew);
  const withinNoncritical = Math.min(day.noncriticalRequiredCrew, withinLimitCrew);
  const withinCritical = withinLimitCrew - withinNoncritical;

  return {
    totalHeightPx,
    noncriticalHeightPx: scalePx(withinNoncritical),
    criticalWithinLimitHeightPx: scalePx(withinCritical),
    overallocatedHeightPx,
    availableLineFromBottomPx,
  };
}

export function buildResourceHistogramTooltipContent(
  day: ResourceHistogramDay,
): ResourceHistogramTooltipContent {
  return {
    projectDay: day.dayOffset,
    calendarDate: formatResourceHistogramCalendarDate(day.date),
    availableCrew: day.availableCrew,
    requiredCrew: day.requiredCrew,
    overallocatedBy: day.overallocatedAmount,
    criticalCrew: day.criticalRequiredCrew,
    noncriticalCrew: day.noncriticalRequiredCrew,
    activeActivityCount: day.activeActivities.length,
    activityLines: day.activeActivities.map(
      (activity) =>
        `${activity.activityCode} ${activity.activityTitle} — Crew ${activity.crewSize} — ${
          activity.isCritical ? 'Critical' : 'Noncritical'
        }`,
    ),
  };
}

export function clampResourceHistogramTooltipPosition(
  anchorRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  tooltipWidth: number,
  tooltipHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { left: number; top: number } {
  const padding = 8;
  let left = anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2;
  let top = anchorRect.top - tooltipHeight - padding;

  if (left < padding) left = padding;
  if (left + tooltipWidth > viewportWidth - padding) {
    left = Math.max(padding, viewportWidth - tooltipWidth - padding);
  }
  if (top < padding) {
    top = anchorRect.top + anchorRect.height + padding;
  }
  if (top + tooltipHeight > viewportHeight - padding) {
    top = Math.max(padding, viewportHeight - tooltipHeight - padding);
  }

  return { left, top };
}
