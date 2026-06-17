/**
 * Credit-aware usage checks — keep in sync with supabase/functions/_shared/usageCredits.ts
 */
import type { PlanId } from './entitlements';
import {
  checkUsageAllowed,
  type UsageLimitCheckResult,
  type UsageUnit,
} from './usageLimits';
import { canPurchaseCreditPacks } from './usageCreditPacks';

export interface UsageLimitCheckWithCredits extends UsageLimitCheckResult {
  creditRemaining: number;
  totalRemaining: number;
  buyMoreAvailable: boolean;
}

export function checkUsageWithCreditsPure(
  planId: PlanId,
  usageUnit: UsageUnit,
  used: number,
  creditRemaining: number,
  quantity = 1,
): UsageLimitCheckWithCredits {
  const base = checkUsageAllowed({ planId, usageUnit, used, quantity });
  const neededFromCredits = Math.max(0, quantity - base.remaining);
  const allowed = base.allowed || creditRemaining >= neededFromCredits;
  const totalRemaining = base.remaining + creditRemaining;

  return {
    ...base,
    allowed,
    creditRemaining,
    totalRemaining,
    buyMoreAvailable: canPurchaseCreditPacks(planId),
  };
}

export function creditsNeededBeyondBase(
  baseRemaining: number,
  quantity: number,
): number {
  return Math.max(0, quantity - baseRemaining);
}
