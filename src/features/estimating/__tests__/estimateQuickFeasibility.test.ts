import { describe, expect, it } from 'vitest';
import {
  computeQuickFeasibility,
  DEFAULT_QUICK_FEASIBILITY_INPUTS,
  QUICK_FEASIBILITY_PREVIEW_HINT,
  validateQuickFeasibilityInputs,
} from '../application/estimateQuickFeasibility';

function expectAllFinite(result: ReturnType<typeof computeQuickFeasibility>): void {
  expect(Number.isFinite(result.baseCost)).toBe(true);
  expect(Number.isFinite(result.likelyTotal)).toBe(true);
  expect(Number.isFinite(result.lowTotal)).toBe(true);
  expect(Number.isFinite(result.highTotal)).toBe(true);
  expect(Number.isFinite(result.effectiveCostPerSF)).toBe(true);
}

describe('estimateQuickFeasibility', () => {
  it('returns safe zero preview for blank inputs', () => {
    const result = computeQuickFeasibility(DEFAULT_QUICK_FEASIBILITY_INPUTS);

    expect(result.isValid).toBe(false);
    expect(result.validationMessages).toEqual([QUICK_FEASIBILITY_PREVIEW_HINT]);
    expect(result.likelyTotal).toBe(0);
    expect(result.baseCost).toBe(0);
    expectAllFinite(result);
  });

  it('computes base, likely total, and range from area and factors', () => {
    const result = computeQuickFeasibility({
      ...DEFAULT_QUICK_FEASIBILITY_INPUTS,
      projectType: 'office',
      location: 'Denver, CO',
      areaSF: 10_000,
      costPerSF: 200,
      locationFactor: 1.1,
      complexityFactor: 1.05,
      contingencyPercent: 10,
    });

    expect(result.isValid).toBe(true);
    expect(result.baseCost).toBe(2_310_000);
    expect(result.likelyTotal).toBe(2_541_000);
    expect(result.effectiveCostPerSF).toBe(254.1);
    expect(result.lowTotal).toBeLessThan(result.likelyTotal);
    expect(result.highTotal).toBeGreaterThan(result.likelyTotal);
    expect(result.assumptions.some((note) => note.includes('Local preview only'))).toBe(true);
    expectAllFinite(result);
  });

  it('applies location factor to base cost', () => {
    const baseline = computeQuickFeasibility({
      ...DEFAULT_QUICK_FEASIBILITY_INPUTS,
      areaSF: 1_000,
      costPerSF: 100,
      locationFactor: 1,
      complexityFactor: 1,
    });
    const adjusted = computeQuickFeasibility({
      ...DEFAULT_QUICK_FEASIBILITY_INPUTS,
      areaSF: 1_000,
      costPerSF: 100,
      locationFactor: 1.2,
      complexityFactor: 1,
    });

    expect(adjusted.baseCost).toBe(120_000);
    expect(adjusted.baseCost).toBeGreaterThan(baseline.baseCost);
  });

  it('applies complexity factor to base cost', () => {
    const baseline = computeQuickFeasibility({
      ...DEFAULT_QUICK_FEASIBILITY_INPUTS,
      areaSF: 1_000,
      costPerSF: 100,
      locationFactor: 1,
      complexityFactor: 1,
    });
    const adjusted = computeQuickFeasibility({
      ...DEFAULT_QUICK_FEASIBILITY_INPUTS,
      areaSF: 1_000,
      costPerSF: 100,
      locationFactor: 1,
      complexityFactor: 1.15,
    });

    expect(adjusted.baseCost).toBe(115_000);
    expect(adjusted.baseCost).toBeGreaterThan(baseline.baseCost);
  });

  it('applies contingency to likely total', () => {
    const withoutContingency = computeQuickFeasibility({
      ...DEFAULT_QUICK_FEASIBILITY_INPUTS,
      areaSF: 1_000,
      costPerSF: 100,
      contingencyPercent: 0,
    });
    const withContingency = computeQuickFeasibility({
      ...DEFAULT_QUICK_FEASIBILITY_INPUTS,
      areaSF: 1_000,
      costPerSF: 100,
      contingencyPercent: 10,
    });

    expect(withoutContingency.likelyTotal).toBe(100_000);
    expect(withContingency.likelyTotal).toBe(110_000);
  });

  it('returns preview hint when core inputs are missing', () => {
    const messages = validateQuickFeasibilityInputs({
      ...DEFAULT_QUICK_FEASIBILITY_INPUTS,
      areaSF: 0,
      costPerSF: 0,
    });

    expect(messages).toEqual([QUICK_FEASIBILITY_PREVIEW_HINT]);
  });

  it('uses wider spread for low-confidence inputs', () => {
    const lowConfidence = computeQuickFeasibility({
      ...DEFAULT_QUICK_FEASIBILITY_INPUTS,
      projectType: '',
      location: '',
      areaSF: 100,
      costPerSF: 10,
    });

    const highConfidence = computeQuickFeasibility({
      ...DEFAULT_QUICK_FEASIBILITY_INPUTS,
      projectType: 'office',
      location: 'Austin, TX',
      areaSF: 25_000,
      costPerSF: 180,
      locationFactor: 1,
      complexityFactor: 1,
      contingencyPercent: 8,
    });

    expect(lowConfidence.confidenceLevel).toBe('low');
    expect(highConfidence.confidenceLevel).toBe('high');

    const lowSpread =
      (lowConfidence.highTotal - lowConfidence.lowTotal) / lowConfidence.likelyTotal;
    const highSpread =
      (highConfidence.highTotal - highConfidence.lowTotal) / highConfidence.likelyTotal;

    expect(lowSpread).toBeGreaterThan(highSpread);
  });

  it('sanitizes negative, NaN, and invalid factors without NaN or Infinity', () => {
    const result = computeQuickFeasibility({
      ...DEFAULT_QUICK_FEASIBILITY_INPUTS,
      areaSF: Number.NaN,
      costPerSF: Number.POSITIVE_INFINITY,
      locationFactor: -1,
      complexityFactor: 0,
      contingencyPercent: 150,
    });

    expect(result.isValid).toBe(false);
    expect(result.likelyTotal).toBe(0);
    expectAllFinite(result);
  });

  it('sanitizes negative factors for valid area and cost', () => {
    const result = computeQuickFeasibility({
      ...DEFAULT_QUICK_FEASIBILITY_INPUTS,
      areaSF: 1_000,
      costPerSF: 100,
      locationFactor: -1,
      complexityFactor: 0,
      contingencyPercent: 150,
    });

    expect(result.baseCost).toBe(100_000);
    expect(result.likelyTotal).toBe(200_000);
    expectAllFinite(result);
  });
});
