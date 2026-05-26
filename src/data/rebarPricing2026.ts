import type { RebarSize } from '../utils/reinforcement';

export interface RebarSizePricing {
  bar: RebarSize;
  diameterIn: number;
  weightLbPerFt: number;
  weightPer20Ft: number;
  estimatedCostEach: number;
}

export const REBAR_PRICING_2026 = {
  currency: 'USD',
  unit: '20ft stick',
  grade: 'Grade 60',
  sizes: [
    { bar: '#1', diameterIn: 0.125, weightLbPerFt: 0.042, weightPer20Ft: 0.84, estimatedCostEach: 2.5 },
    { bar: '#2', diameterIn: 0.25, weightLbPerFt: 0.167, weightPer20Ft: 3.34, estimatedCostEach: 5.0 },
    { bar: '#3', diameterIn: 0.375, weightLbPerFt: 0.376, weightPer20Ft: 7.52, estimatedCostEach: 8.5 },
    { bar: '#4', diameterIn: 0.5, weightLbPerFt: 0.668, weightPer20Ft: 13.36, estimatedCostEach: 14.5 },
    { bar: '#5', diameterIn: 0.625, weightLbPerFt: 1.043, weightPer20Ft: 20.86, estimatedCostEach: 22.0 },
    { bar: '#6', diameterIn: 0.75, weightLbPerFt: 1.502, weightPer20Ft: 30.04, estimatedCostEach: 31.0 },
    { bar: '#7', diameterIn: 0.875, weightLbPerFt: 2.044, weightPer20Ft: 40.88, estimatedCostEach: 42.0 },
    { bar: '#8', diameterIn: 1.0, weightLbPerFt: 2.67, weightPer20Ft: 53.4, estimatedCostEach: 55.0 },
  ] as RebarSizePricing[],
} as const;

const BY_BAR = new Map<RebarSize, RebarSizePricing>(
  REBAR_PRICING_2026.sizes.map((s) => [s.bar, s]),
);

export function getRebarSizePricing(bar: RebarSize): RebarSizePricing | undefined {
  return BY_BAR.get(bar);
}
