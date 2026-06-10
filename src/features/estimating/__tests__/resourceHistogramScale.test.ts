import { describe, expect, it } from 'vitest';
import {
  computeResourceHistogramChartMax,
  computeResourceHistogramScale,
  crewValueToPlotHeightPx,
  crewValueToPlotRatio,
  generateResourceHistogramYAxisTicks,
  niceRoundedChartMax,
} from '../ui/components/scheduling/resourceHistogramScale';
import { computeResourceHistogramBarSegments } from '../ui/components/scheduling/resourceHistogramUi';
import type { ResourceHistogramDay } from '../scheduling/cpmTypes';

describe('resourceHistogramScale', () => {
  it('rounds chart max to clean values', () => {
    expect(niceRoundedChartMax(9)).toBe(10);
    expect(niceRoundedChartMax(33)).toBe(40);
    expect(niceRoundedChartMax(75)).toBe(80);
    expect(niceRoundedChartMax(0)).toBe(10);
  });

  it('uses max of peak demand and available crew for chart max', () => {
    expect(computeResourceHistogramChartMax(33, 7)).toBe(40);
    expect(computeResourceHistogramChartMax(8, 10)).toBe(10);
    expect(computeResourceHistogramChartMax(75, 20)).toBe(80);
  });

  it('generates readable Y-axis ticks', () => {
    expect(generateResourceHistogramYAxisTicks(10)).toEqual([0, 5, 10]);
    expect(generateResourceHistogramYAxisTicks(20)).toEqual([0, 10, 20]);
    expect(generateResourceHistogramYAxisTicks(40)).toEqual([0, 10, 20, 30, 40]);
    expect(generateResourceHistogramYAxisTicks(100)).toEqual([0, 25, 50, 75, 100]);
  });

  it('builds scale from demand and available crew', () => {
    expect(computeResourceHistogramScale({ maxCrewDemand: 33, availableCrew: 7 })).toEqual({
      chartMax: 40,
      yAxisTicks: [0, 10, 20, 30, 40],
    });
  });

  it('maps crew values to plot ratios and heights', () => {
    expect(crewValueToPlotRatio(33, 40)).toBeCloseTo(0.825);
    expect(crewValueToPlotRatio(7, 40)).toBeCloseTo(0.175);
    expect(crewValueToPlotHeightPx(33, 40, 80)).toBe(66);
    expect(crewValueToPlotHeightPx(0, 40, 80)).toBe(0);
  });

  it('keeps a stable scale when demand is zero', () => {
    expect(computeResourceHistogramScale({ maxCrewDemand: 0, availableCrew: 7 })).toEqual({
      chartMax: 10,
      yAxisTicks: [0, 5, 10],
    });
  });

  it('aligns bar height to the same chart max scale', () => {
    const day: ResourceHistogramDay = {
      dayOffset: 0,
      date: '2026-01-01',
      requiredCrew: 33,
      criticalRequiredCrew: 33,
      noncriticalRequiredCrew: 0,
      availableCrew: 7,
      overallocatedAmount: 26,
      isOverallocated: true,
      activeActivities: [],
    };
    const segments = computeResourceHistogramBarSegments(day, 40, 80);

    expect(segments.totalHeightPx).toBe(66);
    expect(segments.overallocatedHeightPx).toBe(52);
    expect(segments.criticalWithinLimitHeightPx).toBe(14);
  });

  it('places available crew line at the correct ratio', () => {
    expect(crewValueToPlotRatio(7, 40)).toBeCloseTo(0.175);
  });
});
