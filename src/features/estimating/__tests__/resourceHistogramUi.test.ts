import { describe, expect, it } from 'vitest';
import type { ResourceHistogramDay } from '../../scheduling/cpmTypes';
import {
  buildResourceHistogramTooltipContent,
  computeResourceHistogramBarSegments,
  formatResourceHistogramCalendarDate,
  RESOURCE_HISTOGRAM_AVAILABLE_CREW_LABEL,
  RESOURCE_HISTOGRAM_LEGEND_CRITICAL,
  RESOURCE_HISTOGRAM_LEGEND_NONCRITICAL,
  RESOURCE_HISTOGRAM_LEGEND_OVERALLOCATED,
  RESOURCE_HISTOGRAM_TOOLTIP_CLASS,
  RESOURCE_HISTOGRAM_X_AXIS_LABEL,
  RESOURCE_HISTOGRAM_Y_AXIS_LABEL,
} from '../ui/components/scheduling/resourceHistogramUi';

function makeDay(overrides: Partial<ResourceHistogramDay> = {}): ResourceHistogramDay {
  return {
    dayOffset: 10,
    date: '2026-08-14',
    requiredCrew: 12,
    criticalRequiredCrew: 5,
    noncriticalRequiredCrew: 7,
    availableCrew: 10,
    overallocatedAmount: 2,
    isOverallocated: true,
    activeActivities: [
      {
        activityCode: '06-02-01',
        activityTitle: 'Wall framing',
        crewSize: 5,
        isCritical: true,
        scheduledStartDay: 8,
        scheduledFinishDay: 12,
      },
      {
        activityCode: '09-01-01',
        activityTitle: 'Drywall hanging',
        crewSize: 4,
        isCritical: false,
        scheduledStartDay: 10,
        scheduledFinishDay: 14,
      },
    ],
    ...overrides,
  };
}

describe('resourceHistogramUi', () => {
  it('formats calendar dates for tooltip display', () => {
    expect(formatResourceHistogramCalendarDate('2026-08-14')).toBe('Aug 14, 2026');
  });

  it('builds tooltip content with crew totals and active activities', () => {
    const content = buildResourceHistogramTooltipContent(makeDay());

    expect(content.projectDay).toBe(10);
    expect(content.calendarDate).toBe('Aug 14, 2026');
    expect(content.availableCrew).toBe(10);
    expect(content.requiredCrew).toBe(12);
    expect(content.overallocatedBy).toBe(2);
    expect(content.criticalCrew).toBe(5);
    expect(content.noncriticalCrew).toBe(7);
    expect(content.activeActivityCount).toBe(2);
    expect(content.activityLines[0]).toContain('06-02-01 Wall framing');
    expect(content.activityLines[0]).toContain('Critical');
    expect(content.activityLines[1]).toContain('Noncritical');
  });

  it('splits bar segments into noncritical, critical, and overallocated crew', () => {
    const segments = computeResourceHistogramBarSegments(makeDay(), 12, 80);

    expect(segments.noncriticalHeightPx).toBeGreaterThan(0);
    expect(segments.criticalWithinLimitHeightPx).toBeGreaterThan(0);
    expect(segments.overallocatedHeightPx).toBeGreaterThan(0);
    expect(segments.totalHeightPx).toBe(80);
    expect(segments.availableLineFromBottomPx).toBe(67);
  });

  it('uses readable tooltip classes for light and dark mode', () => {
    expect(RESOURCE_HISTOGRAM_TOOLTIP_CLASS).toContain('text-slate-900');
    expect(RESOURCE_HISTOGRAM_TOOLTIP_CLASS).toContain('dark:text-slate-100');
    expect(RESOURCE_HISTOGRAM_TOOLTIP_CLASS).toContain('bg-white');
    expect(RESOURCE_HISTOGRAM_TOOLTIP_CLASS).toContain('dark:bg-slate-800');
  });

  it('exposes axis and legend labels used by the histogram', () => {
    expect(RESOURCE_HISTOGRAM_X_AXIS_LABEL).toBe('Project day');
    expect(RESOURCE_HISTOGRAM_Y_AXIS_LABEL).toBe('Crew required');
    expect(RESOURCE_HISTOGRAM_AVAILABLE_CREW_LABEL).toBe('Available crew');
    expect(RESOURCE_HISTOGRAM_LEGEND_NONCRITICAL).toBe('Noncritical crew');
    expect(RESOURCE_HISTOGRAM_LEGEND_CRITICAL).toBe('Critical crew');
    expect(RESOURCE_HISTOGRAM_LEGEND_OVERALLOCATED).toBe('Overallocated crew');
  });
});
