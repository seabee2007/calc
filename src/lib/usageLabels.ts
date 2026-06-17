import type { PlanId } from './entitlements';
import { PLAN_ORDER } from './entitlements';
import type { UsageUnit } from './usageLimits';

export const USAGE_UNIT_LABELS: Record<UsageUnit, string> = {
  ai_request: 'AI requests',
  weather_request: 'Weather forecasts',
  geocode_request: 'Address lookups',
  travel_request: 'Travel-time checks',
  place_search: 'Place searches',
  email_send: 'Email sends',
};

/** Billing panel groupings for compact display. */
export const USAGE_BILLING_GROUPS: Array<{
  id: string;
  label: string;
  units: UsageUnit[];
}> = [
  { id: 'ai', label: 'AI requests', units: ['ai_request'] },
  { id: 'weather', label: 'Weather requests', units: ['weather_request'] },
  {
    id: 'map',
    label: 'Map / geocode requests',
    units: ['geocode_request', 'travel_request', 'place_search'],
  },
  { id: 'email', label: 'Email sends', units: ['email_send'] },
];

export type UsageStateBand = 'normal' | 'caution' | 'warning' | 'blocked';

export function getUsageUnitLabel(unit: UsageUnit): string {
  return USAGE_UNIT_LABELS[unit];
}

export function computePercentUsed(used: number, limit: number): number {
  if (limit < 0) return 0;
  if (limit === 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function getUsageStateBand(percentUsed: number, limit: number): UsageStateBand {
  if (limit === 0 || percentUsed >= 100) return 'blocked';
  if (percentUsed >= 90) return 'warning';
  if (percentUsed >= 70) return 'caution';
  return 'normal';
}

export function usageStateProgressClass(band: UsageStateBand): string {
  switch (band) {
    case 'blocked':
      return 'bg-red-600 dark:bg-red-500';
    case 'warning':
      return 'bg-amber-500 dark:bg-amber-400';
    case 'caution':
      return 'bg-yellow-500 dark:bg-yellow-400';
    default:
      return 'bg-cyan-600 dark:bg-cyan-500';
  }
}

export function usageStateTextClass(band: UsageStateBand): string {
  switch (band) {
    case 'blocked':
      return 'text-red-700 dark:text-red-300';
    case 'warning':
      return 'text-amber-700 dark:text-amber-300';
    case 'caution':
      return 'text-yellow-700 dark:text-yellow-300';
    default:
      return 'text-slate-600 dark:text-slate-400';
  }
}

export function formatUsageResetDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Next billing period';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatUsageQuota(used: number, limit: number, creditRemaining = 0): string {
  const base =
    limit < 0
      ? `${used.toLocaleString()} / Unlimited`
      : `${used.toLocaleString()} / ${limit.toLocaleString()}`;
  if (creditRemaining > 0) {
    return `${base} + ${creditRemaining.toLocaleString()} credits`;
  }
  return base;
}

export function nextUpgradePlan(planId: PlanId): PlanId | null {
  const index = PLAN_ORDER.indexOf(planId as (typeof PLAN_ORDER)[number]);
  if (index < 0) return 'starter';
  if (index >= PLAN_ORDER.length - 1) return null;
  return PLAN_ORDER[index + 1];
}

export function usageUpgradeCtaLabel(planId: PlanId): string {
  const next = nextUpgradePlan(planId);
  if (!next) return 'Need more? Contact support';
  switch (next) {
    case 'starter':
      return 'Upgrade for higher usage';
    case 'professional':
      return 'Upgrade to Professional for higher usage';
    case 'business':
      return 'Upgrade to Business for higher usage';
    default:
      return 'Upgrade plan';
  }
}
