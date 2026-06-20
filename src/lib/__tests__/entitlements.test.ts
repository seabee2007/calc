import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PLAN_FEATURES,
  canUseThreeDTakeoffCapability,
  canCreateProject,
  canInviteFieldSeat,
  canInviteTeamMember,
  canUseFeature,
  getPlanLimit,
  hasFeature,
  hasThreeDTakeoffCapability,
  minPlanForFeature,
  resolveEffectivePlan,
  type FeatureKey,
} from '../entitlements';

describe('entitlements', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_ENFORCE_PLAN', 'true');
  });

  it('Starter includes core foundation features and one employee field portal seat', () => {
    expect(hasFeature('starter', 'quick_estimates')).toBe(true);
    expect(hasFeature('starter', 'conceptual_estimates')).toBe(true);
    expect(hasFeature('starter', 'calculators')).toBe(true);
    expect(hasFeature('starter', 'global_ask_ai')).toBe(true);
    expect(hasFeature('starter', 'employee_portal')).toBe(true);
    expect(hasFeature('starter', 'activity_based_estimating')).toBe(false);
    expect(hasFeature('starter', 'logic_network')).toBe(false);
    expect(hasFeature('starter', 'model_3d_takeoff')).toBe(false);
    expect(hasFeature('starter', 'design_builder')).toBe(false);
    expect(hasFeature('starter', 'ai_concrete_chat')).toBe(false);
  });

  it('Professional includes field workflows and Arden Calc in estimator', () => {
    expect(hasFeature('professional', 'activity_based_estimating')).toBe(true);
    expect(hasFeature('professional', 'employee_portal')).toBe(true);
    expect(hasFeature('professional', 'logic_network')).toBe(true);
    expect(hasFeature('professional', 'level_three_gantt')).toBe(true);
    expect(hasFeature('professional', 'global_ask_ai')).toBe(true);
    expect(hasFeature('professional', 'level_three_gantt_export')).toBe(false);
    expect(hasFeature('professional', 'arden_calc_in_estimator')).toBe(true);
    expect(hasFeature('professional', 'model_3d_takeoff')).toBe(true);
    expect(hasFeature('professional', 'design_builder')).toBe(true);
    expect(hasFeature('professional', 'model_3d_extraction')).toBe(false);
    expect(hasFeature('professional', 'accounting_exports')).toBe(false);
  });

  it('Business includes AI, exports, and portfolio features', () => {
    expect(hasFeature('business', 'level_three_gantt_export')).toBe(true);
    expect(hasFeature('business', 'accounting_exports')).toBe(true);
    expect(hasFeature('business', 'financial_dashboard')).toBe(true);
    expect(hasFeature('business', 'global_ask_ai')).toBe(true);
    expect(hasFeature('business', 'ai_concrete_chat')).toBe(true);
    expect(hasFeature('business', 'contract_builder')).toBe(true);
    expect(hasFeature('business', 'global_planner_hub')).toBe(true);
    expect(hasFeature('business', 'model_3d_extraction')).toBe(true);
  });

  it('returns configured plan limits', () => {
    expect(getPlanLimit('starter', 'max_active_projects')).toBe(3);
    expect(getPlanLimit('starter', 'included_field_seats')).toBe(1);
    expect(getPlanLimit('professional', 'included_field_seats')).toBe(5);
    expect(getPlanLimit('business', 'max_active_projects')).toBe(-1);
    expect(getPlanLimit('business', 'ai_requests_monthly')).toBe(500);
    expect(getPlanLimit('professional', 'max_3d_models_per_project')).toBe(10);
    expect(getPlanLimit('professional', 'max_3d_model_size_mb')).toBe(100);
    expect(getPlanLimit('business', 'max_3d_models_per_project')).toBe(50);
    expect(getPlanLimit('business', 'max_3d_model_size_mb')).toBe(500);
  });

  it('canCreateProject respects active project limits', () => {
    expect(canCreateProject('free', 0)).toBe(true);
    expect(canCreateProject('free', 1)).toBe(false);
    expect(canCreateProject('starter', 2)).toBe(true);
    expect(canCreateProject('starter', 3)).toBe(false);
    expect(canCreateProject('professional', 9)).toBe(true);
    expect(canCreateProject('professional', 10)).toBe(false);
    expect(canCreateProject('business', 100)).toBe(true);
    expect(canCreateProject(null, 0)).toBe(false);
  });

  it('canInviteFieldSeat respects included and max field seats', () => {
    expect(canInviteFieldSeat('starter', 0)).toBe(true);
    expect(canInviteFieldSeat('starter', 1)).toBe(false);
    expect(canInviteFieldSeat('professional', 4)).toBe(true);
    expect(canInviteFieldSeat('professional', 25)).toBe(false);
    expect(canInviteFieldSeat('business', 20)).toBe(true);
  });

  it('canInviteTeamMember allows Starter one included field seat and blocks only capacity', () => {
    expect(canInviteTeamMember('starter', 0)).toBe(true);
    expect(canInviteTeamMember('starter', 1)).toBe(false);
    expect(canInviteTeamMember('professional', 0)).toBe(true);
    expect(canInviteTeamMember('professional', 4)).toBe(true);
    expect(canInviteTeamMember('professional', 5)).toBe(false);
    expect(canInviteTeamMember('business', 14)).toBe(true);
    expect(canInviteTeamMember('business', 15)).toBe(false);
    expect(canInviteTeamMember(null, 0)).toBe(false);
  });

  it('minPlanForFeature resolves the lowest plan that includes a feature', () => {
    expect(minPlanForFeature('quick_estimates')).toBe('starter');
    expect(minPlanForFeature('global_ask_ai')).toBe('starter');
    expect(minPlanForFeature('employee_portal')).toBe('starter');
    expect(minPlanForFeature('logic_network')).toBe('professional');
    expect(minPlanForFeature('ai_concrete_chat')).toBe('business');
  });

  it('resolveEffectivePlan falls back to free for inactive/missing subscriptions', () => {
    expect(resolveEffectivePlan({ planId: 'business', status: 'active' })).toBe('business');
    expect(resolveEffectivePlan({ planId: 'professional', status: 'trialing' })).toBe(
      'professional',
    );
    expect(resolveEffectivePlan({ planId: 'business', status: 'canceled' })).toBe('free');
    expect(resolveEffectivePlan(null)).toBe('free');
  });

  it('Free plan has max_active_projects = 1 and no paid features', () => {
    expect(getPlanLimit('free', 'max_active_projects')).toBe(1);
    expect(hasFeature('free', 'quick_estimates')).toBe(true);
    expect(hasFeature('free', 'global_ask_ai')).toBe(false);
    expect(hasFeature('free', 'conceptual_estimates')).toBe(false);
    expect(hasFeature('free', 'employee_portal')).toBe(false);
    expect(hasFeature('free', 'client_portal')).toBe(false);
    expect(hasFeature('free', 'activity_based_estimating')).toBe(false);
  });

  it('canUseFeature bypasses enforcement in local dev by default', () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_ENFORCE_PLAN', 'false');
    expect(canUseFeature('starter', 'ai_concrete_chat')).toBe(true);
  });

  it('splits 3D Takeoff MVP and advanced BIM capabilities by plan', () => {
    expect(hasThreeDTakeoffCapability('free', 'viewDemo')).toBe(true);
    expect(hasThreeDTakeoffCapability('starter', 'viewDemo')).toBe(true);
    expect(hasThreeDTakeoffCapability('starter', 'uploadGlb')).toBe(false);
    expect(hasThreeDTakeoffCapability('professional', 'uploadGlb')).toBe(true);
    expect(hasThreeDTakeoffCapability('professional', 'measureTool')).toBe(true);
    expect(hasThreeDTakeoffCapability('professional', 'scaleCalibration')).toBe(true);
    expect(hasThreeDTakeoffCapability('professional', 'addToEstimate')).toBe(true);
    expect(hasThreeDTakeoffCapability('professional', 'ifcImport')).toBe(false);
    expect(hasThreeDTakeoffCapability('business', 'ifcImport')).toBe(true);
    expect(hasThreeDTakeoffCapability('business', 'modelVersionCompare')).toBe(true);
    expect(hasThreeDTakeoffCapability('business', 'aiObjectMapping')).toBe(true);
  });

  it('canUseThreeDTakeoffCapability respects enforcement and missing plans', () => {
    expect(canUseThreeDTakeoffCapability('professional', 'uploadGlb')).toBe(true);
    expect(canUseThreeDTakeoffCapability('starter', 'uploadGlb')).toBe(false);
    expect(canUseThreeDTakeoffCapability(null, 'uploadGlb')).toBe(false);
  });

  it('defines every feature key in at least one plan map entry', () => {
    const allFeatures = new Set<FeatureKey>();
    for (const plan of Object.keys(PLAN_FEATURES) as Array<keyof typeof PLAN_FEATURES>) {
      for (const feature of PLAN_FEATURES[plan]) {
        allFeatures.add(feature);
      }
    }
    expect(allFeatures.has('global_ask_ai')).toBe(true);
    expect(allFeatures.has('arden_calc_in_estimator')).toBe(true);
    expect(allFeatures.has('global_planner_hub')).toBe(true);
    expect(allFeatures.has('design_builder')).toBe(true);
  });
});
