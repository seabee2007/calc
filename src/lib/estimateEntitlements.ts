import type { EstimateType } from '../features/estimating/domain/estimateTypes';
import { normalizeEstimateMethod } from '../features/estimating/domain/estimateMethods';
import { canUseFeature, type FeatureKey, type PlanId } from './entitlements';

export function getFeatureKeyForEstimateType(
  type: EstimateType | string | null | undefined,
): FeatureKey {
  const normalized = normalizeEstimateMethod(type);
  if (normalized === 'quick') return 'quick_estimates';
  if (normalized === 'conceptual') return 'conceptual_estimates';
  return 'activity_based_estimating';
}

export function canUseEstimateType(
  plan: PlanId | null | undefined,
  type: EstimateType | string | null | undefined,
): boolean {
  return canUseFeature(plan, getFeatureKeyForEstimateType(type));
}

/** Highest estimate type the plan should default to when opening the workspace. */
export function getDefaultEstimateTypeForPlan(plan: PlanId | null | undefined): EstimateType {
  if (canUseFeature(plan, 'activity_based_estimating')) {
    return 'detailed';
  }
  if (canUseFeature(plan, 'quick_estimates')) {
    return 'quick';
  }
  if (canUseFeature(plan, 'conceptual_estimates')) {
    return 'conceptual';
  }
  return 'quick';
}
