import type { PlanId } from './entitlements';
import { getUsagePeriod } from './usageLimits';
import {
  formatUsageQuota,
  formatUsageResetDate,
  getUsageUnitLabel,
  nextUpgradePlan,
} from './usageLabels';
import { creditPackIdForUsageUnit } from './usageCreditPacks';
import { creditPackLabel } from './usageCreditPackCheckout';
import {
  UsageLimitError,
  buildBillingUpgradeUrl,
  isUsageLimitError,
  usageLimitMessage,
} from './usageMetering';

export interface UsageLimitPresentation {
  title: string;
  message: string;
  quotaLabel: string;
  resetLabel: string;
  upgradeUrl: string | null;
  upgradeLabel: string;
  buyMorePackId: string | null;
  buyMoreLabel: string | null;
  primaryAction: 'upgrade' | 'buy';
}

export function buildUsageLimitPresentation(error: UsageLimitError): UsageLimitPresentation {
  const period = getUsagePeriod();
  const upgradePlan = nextUpgradePlan(error.planId);
  const unitLabel = getUsageUnitLabel(error.usageUnit);
  const buyMorePackId =
    error.buyMoreAvailable ? creditPackIdForUsageUnit(error.usageUnit) : null;

  const primaryAction: 'upgrade' | 'buy' =
    error.planId === 'free' || !buyMorePackId ? 'upgrade' : 'buy';

  return {
    title: `Monthly ${unitLabel} limit reached`,
    message: usageLimitMessage(error.usageUnit),
    quotaLabel: formatUsageQuota(error.used, error.limit, error.creditRemaining),
    resetLabel: `Resets ${formatUsageResetDate(period.end)}`,
    upgradeUrl: upgradePlan ? buildBillingUpgradeUrl(upgradePlan) : '/settings/billing',
    upgradeLabel: upgradePlan ? 'Upgrade plan' : 'View Billing',
    buyMorePackId,
    buyMoreLabel: buyMorePackId ? `Buy ${creditPackLabel(buyMorePackId)}` : null,
    primaryAction,
  };
}

export function usageLimitToastMessage(error: UsageLimitError): string {
  const presentation = buildUsageLimitPresentation(error);
  return `${presentation.message} (${presentation.quotaLabel}. ${presentation.resetLabel})`;
}

export function resolveUsageLimitError(error: unknown): UsageLimitPresentation | null {
  if (!isUsageLimitError(error)) return null;
  return buildUsageLimitPresentation(error);
}

export function usageLimitPlanId(error: unknown): PlanId | null {
  return isUsageLimitError(error) ? error.planId : null;
}

export function buildBillingBuyCreditsUrl(packId: string, returnTo?: string): string {
  const params = new URLSearchParams({ buyCredits: packId });
  if (returnTo) params.set('returnTo', returnTo);
  return `/settings/billing?${params.toString()}#usage`;
}
