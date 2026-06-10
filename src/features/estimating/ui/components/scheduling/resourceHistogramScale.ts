export interface ResourceHistogramScale {
  chartMax: number;
  yAxisTicks: number[];
}

export function niceRoundedChartMax(rawMax: number): number {
  if (rawMax <= 0) return 10;
  if (rawMax <= 10) return 10;
  if (rawMax <= 50) {
    const step = rawMax <= 20 ? 5 : 10;
    return Math.ceil(rawMax / step) * step;
  }
  if (rawMax <= 100) {
    return Math.ceil(rawMax / 10) * 10;
  }
  if (rawMax <= 200) {
    return Math.ceil(rawMax / 25) * 25;
  }
  return Math.ceil(rawMax / 50) * 50;
}

export function computeResourceHistogramChartMax(
  maxCrewDemand: number,
  availableCrew: number,
): number {
  return niceRoundedChartMax(Math.max(0, maxCrewDemand, availableCrew));
}

function pickYAxisTickStep(chartMax: number): number {
  if (chartMax <= 10) return 5;
  if (chartMax <= 20) return 10;
  if (chartMax <= 50) return 10;
  if (chartMax <= 100) {
    return chartMax % 25 === 0 ? 25 : 10;
  }
  if (chartMax <= 200) return 25;
  return 50;
}

export function generateResourceHistogramYAxisTicks(chartMax: number): number[] {
  if (chartMax <= 0) return [0, 5, 10];

  const step = pickYAxisTickStep(chartMax);
  const ticks: number[] = [];
  for (let value = 0; value <= chartMax; value += step) {
    ticks.push(value);
  }
  if (ticks[ticks.length - 1] !== chartMax) {
    ticks.push(chartMax);
  }
  return ticks;
}

export function computeResourceHistogramScale(params: {
  maxCrewDemand: number;
  availableCrew: number;
}): ResourceHistogramScale {
  const chartMax = computeResourceHistogramChartMax(
    params.maxCrewDemand,
    params.availableCrew,
  );
  return {
    chartMax,
    yAxisTicks: generateResourceHistogramYAxisTicks(chartMax),
  };
}

export function crewValueToPlotRatio(crewValue: number, chartMax: number): number {
  if (chartMax <= 0) return 0;
  return Math.max(0, Math.min(1, crewValue / chartMax));
}

export function crewValueToPlotHeightPx(
  crewValue: number,
  chartMax: number,
  plotHeightPx: number,
): number {
  return Math.round(crewValueToPlotRatio(crewValue, chartMax) * plotHeightPx);
}
