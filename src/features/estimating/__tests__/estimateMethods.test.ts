import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ESTIMATE_METHOD,
  ESTIMATE_METHODS,
  ESTIMATE_TYPES,
  getEstimateMethod,
  listEstimateMethods,
  normalizeEstimateMethod,
} from '../domain/estimateMethods';

describe('estimateMethods', () => {
  it('defines all four estimate methods', () => {
    expect(ESTIMATE_TYPES).toEqual([
      'quick_feasibility',
      'budget',
      'detailed',
      'bid',
    ]);
    expect(ESTIMATE_METHODS).toHaveLength(4);
    expect(listEstimateMethods()).toHaveLength(4);
  });

  it('defaults to detailed', () => {
    expect(DEFAULT_ESTIMATE_METHOD).toBe('detailed');
    expect(normalizeEstimateMethod(undefined)).toBe('detailed');
    expect(normalizeEstimateMethod(null)).toBe('detailed');
  });

  it('includes workflow notes for each method', () => {
    expect(getEstimateMethod('quick_feasibility').workflowNote).toBe(
      'Fast rough number for early planning.',
    );
    expect(getEstimateMethod('budget').workflowNote).toBe(
      'Rough budget by division or scope.',
    );
    expect(getEstimateMethod('detailed').workflowNote).toBe(
      'Activity-based estimating with schedule support.',
    );
    expect(getEstimateMethod('bid').workflowNote).toBe(
      'Proposal-ready scope, pricing, and contract support.',
    );
  });

  it('marks schedule and proposal recommendations correctly', () => {
    expect(getEstimateMethod('quick_feasibility').schedulePreviewRecommended).toBe(false);
    expect(getEstimateMethod('budget').schedulePreviewRecommended).toBe(false);
    expect(getEstimateMethod('detailed').schedulePreviewRecommended).toBe(true);
    expect(getEstimateMethod('bid').schedulePreviewRecommended).toBe(true);

    expect(getEstimateMethod('quick_feasibility').proposalGenerationRecommended).toBe(false);
    expect(getEstimateMethod('budget').proposalGenerationRecommended).toBe(false);
    expect(getEstimateMethod('detailed').proposalGenerationRecommended).toBe(false);
    expect(getEstimateMethod('bid').proposalGenerationRecommended).toBe(true);
  });

  it('falls back safely for unknown methods', () => {
    const method = getEstimateMethod('unknown_type');
    expect(method.id).toBe('detailed');
    expect(normalizeEstimateMethod('unknown_type')).toBe('detailed');
  });
});
