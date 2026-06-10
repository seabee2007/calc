import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ESTIMATE_METHOD,
  ESTIMATE_METHODS,
  ESTIMATE_TYPES,
  getEstimateMethod,
  getEstimateTypeLabel,
  isQuickEstimateType,
  listEstimateMethods,
  normalizeEstimateMethod,
  resolveSchedulingEnabled,
  supportsConstructionActivitiesWorkflow,
} from '../domain/estimateMethods';

describe('estimateMethods', () => {
  it('defines all eight estimate methods', () => {
    expect(ESTIMATE_TYPES).toEqual([
      'quick',
      'conceptual',
      'detailed',
      'bid',
      'change_order',
      'unit_price',
      'self_perform_labor',
      'subcontractor_quote',
    ]);
    expect(ESTIMATE_METHODS).toHaveLength(8);
    expect(listEstimateMethods()).toHaveLength(8);
  });

  it('defaults to detailed', () => {
    expect(DEFAULT_ESTIMATE_METHOD).toBe('detailed');
    expect(normalizeEstimateMethod(undefined)).toBe('detailed');
    expect(normalizeEstimateMethod(null)).toBe('detailed');
  });

  it('normalizes legacy estimate types', () => {
    expect(normalizeEstimateMethod('quick_feasibility')).toBe('quick');
    expect(normalizeEstimateMethod('budget')).toBe('conceptual');
  });

  it('includes workflow notes for core methods', () => {
    expect(getEstimateMethod('quick').workflowNote).toBe(
      'Fast rough number for early planning.',
    );
    expect(getEstimateMethod('conceptual').workflowNote).toBe(
      'Early budget with assumptions and allowances.',
    );
    expect(getEstimateMethod('detailed').workflowNote).toBe(
      'Activity-based estimating with schedule support.',
    );
    expect(getEstimateMethod('bid').workflowNote).toBe(
      'Proposal-ready scope, pricing, and contract support.',
    );
  });

  it('marks schedule defaults correctly', () => {
    expect(resolveSchedulingEnabled('quick', null)).toBe(false);
    expect(resolveSchedulingEnabled('conceptual', null)).toBe(false);
    expect(resolveSchedulingEnabled('detailed', null)).toBe(true);
    expect(resolveSchedulingEnabled('bid', null)).toBe(true);
    expect(resolveSchedulingEnabled('self_perform_labor', null)).toBe(true);
    expect(resolveSchedulingEnabled('subcontractor_quote', null)).toBe(false);
  });

  it('supports construction activities workflow for detailed, bid, and self-perform', () => {
    expect(supportsConstructionActivitiesWorkflow('detailed')).toBe(true);
    expect(supportsConstructionActivitiesWorkflow('bid')).toBe(true);
    expect(supportsConstructionActivitiesWorkflow('self_perform_labor')).toBe(true);
    expect(supportsConstructionActivitiesWorkflow('quick')).toBe(false);
  });

  it('identifies quick estimates including legacy values', () => {
    expect(isQuickEstimateType('quick')).toBe(true);
    expect(isQuickEstimateType('quick_feasibility')).toBe(true);
    expect(isQuickEstimateType('detailed')).toBe(false);
  });

  it('falls back safely for unknown methods', () => {
    const method = getEstimateMethod('unknown_type');
    expect(method.id).toBe('detailed');
    expect(normalizeEstimateMethod('unknown_type')).toBe('detailed');
  });

  it('returns labels for canonical types', () => {
    expect(getEstimateTypeLabel('detailed')).toBe('Detailed Estimate');
    expect(getEstimateTypeLabel('quick_feasibility')).toBe('Quick Estimate');
  });
});
