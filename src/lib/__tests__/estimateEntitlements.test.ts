import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canUseEstimateType,
  getDefaultEstimateTypeForPlan,
  getFeatureKeyForEstimateType,
} from '../estimateEntitlements';

describe('estimateEntitlements', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_ENFORCE_PLAN', 'true');
  });

  it('maps quick and conceptual estimate types to starter features', () => {
    expect(getFeatureKeyForEstimateType('quick')).toBe('quick_estimates');
    expect(getFeatureKeyForEstimateType('conceptual')).toBe('conceptual_estimates');
  });

  it('maps detailed and activity-based estimate types to activity_based_estimating', () => {
    expect(getFeatureKeyForEstimateType('detailed')).toBe('activity_based_estimating');
    expect(getFeatureKeyForEstimateType('bid')).toBe('activity_based_estimating');
    expect(getFeatureKeyForEstimateType('self_perform_labor')).toBe('activity_based_estimating');
  });

  it('defaults Starter users to Quick Estimate', () => {
    expect(getDefaultEstimateTypeForPlan('starter')).toBe('quick');
    expect(getDefaultEstimateTypeForPlan(null)).toBe('quick');
  });

  it('defaults Professional and Business users to Detailed Estimate', () => {
    expect(getDefaultEstimateTypeForPlan('professional')).toBe('detailed');
    expect(getDefaultEstimateTypeForPlan('business')).toBe('detailed');
  });

  it('allows Starter users only supported estimate types', () => {
    expect(canUseEstimateType('starter', 'quick')).toBe(true);
    expect(canUseEstimateType('starter', 'conceptual')).toBe(true);
    expect(canUseEstimateType('starter', 'detailed')).toBe(false);
  });

  it('allows Professional users detailed estimate types', () => {
    expect(canUseEstimateType('professional', 'detailed')).toBe(true);
    expect(canUseEstimateType('professional', 'quick')).toBe(true);
  });
});
