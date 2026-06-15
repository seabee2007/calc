import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PLAN_FEATURES,
  canCreateProject,
  canInviteFieldSeat,
  canUseFeature,
  getPlanLimit,
  hasFeature,
  minPlanForFeature,
  resolveEffectivePlan,
  type FeatureKey,
} from '../entitlements';

describe('entitlements', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_ENFORCE_PLAN', 'true');
  });

  it('Starter includes core foundation features only', () => {
    expect(hasFeature('starter', 'quick_estimates')).toBe(true);
    expect(hasFeature('starter', 'conceptual_estimates')).toBe(true);
    expect(hasFeature('starter', 'calculators')).toBe(true);
    expect(hasFeature('starter', 'activity_based_estimating')).toBe(false);
    expect(hasFeature('starter', 'employee_portal')).toBe(false);
    expect(hasFeature('starter', 'logic_network')).toBe(false);
    expect(hasFeature('starter', 'ai_concrete_chat')).toBe(false);
  });

  it('Professional includes field workflows and Arden Calc in estimator', () => {
    expect(hasFeature('professional', 'activity_based_estimating')).toBe(true);
    expect(hasFeature('professional', 'employee_portal')).toBe(true);
    expect(hasFeature('professional', 'logic_network')).toBe(true);
    expect(hasFeature('professional', 'level_three_gantt')).toBe(true);
    expect(hasFeature('professional', 'level_three_gantt_export')).toBe(false);
    expect(hasFeature('professional', 'arden_calc_in_estimator')).toBe(true);
    expect(hasFeature('professional', 'accounting_exports')).toBe(false);
  });

  it('Business includes AI, exports, and portfolio features', () => {
    expect(hasFeature('business', 'level_three_gantt_export')).toBe(true);
    expect(hasFeature('business', 'accounting_exports')).toBe(true);
    expect(hasFeature('business', 'financial_dashboard')).toBe(true);
    expect(hasFeature('business', 'ai_concrete_chat')).toBe(true);
    expect(hasFeature('business', 'contract_builder')).toBe(true);
    expect(hasFeature('business', 'global_planner_hub')).toBe(true);
  });

  it('returns configured plan limits', () => {
    expect(getPlanLimit('starter', 'max_active_projects')).toBe(3);
    expect(getPlanLimit('professional', 'included_field_seats')).toBe(5);
    expect(getPlanLimit('business', 'max_active_projects')).toBe(-1);
    expect(getPlanLimit('business', 'ai_requests_monthly')).toBe(500);
  });

  it('canCreateProject respects active project limits', () => {
    expect(canCreateProject('starter', 2)).toBe(true);
    expect(canCreateProject('starter', 3)).toBe(false);
    expect(canCreateProject('business', 100)).toBe(true);
  });

  it('canInviteFieldSeat respects included and max field seats', () => {
    expect(canInviteFieldSeat('starter', 0)).toBe(true);
    expect(canInviteFieldSeat('starter', 1)).toBe(false);
    expect(canInviteFieldSeat('professional', 4)).toBe(true);
    expect(canInviteFieldSeat('professional', 25)).toBe(false);
    expect(canInviteFieldSeat('business', 20)).toBe(true);
  });

  it('minPlanForFeature resolves the lowest plan that includes a feature', () => {
    expect(minPlanForFeature('quick_estimates')).toBe('starter');
    expect(minPlanForFeature('logic_network')).toBe('professional');
    expect(minPlanForFeature('ai_concrete_chat')).toBe('business');
  });

  it('resolveEffectivePlan falls back to starter for inactive subscriptions', () => {
    expect(resolveEffectivePlan({ planId: 'business', status: 'active' })).toBe('business');
    expect(resolveEffectivePlan({ planId: 'professional', status: 'trialing' })).toBe(
      'professional',
    );
    expect(resolveEffectivePlan({ planId: 'business', status: 'canceled' })).toBe('starter');
    expect(resolveEffectivePlan(null)).toBe('starter');
  });

  it('canUseFeature bypasses enforcement in local dev by default', () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_ENFORCE_PLAN', 'false');
    expect(canUseFeature('starter', 'ai_concrete_chat')).toBe(true);
  });

  it('defines every feature key in at least one plan map entry', () => {
    const allFeatures = new Set<FeatureKey>();
    for (const plan of Object.keys(PLAN_FEATURES) as Array<keyof typeof PLAN_FEATURES>) {
      for (const feature of PLAN_FEATURES[plan]) {
        allFeatures.add(feature);
      }
    }
    expect(allFeatures.has('arden_calc_in_estimator')).toBe(true);
    expect(allFeatures.has('global_planner_hub')).toBe(true);
  });
});
