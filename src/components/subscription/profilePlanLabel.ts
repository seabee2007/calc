import {
  isSubscriptionStatusActive,
  PLAN_DISPLAY_NAMES,
  type PlanId,
} from '../../lib/entitlements';
import type { SubscriptionRow } from '../../services/subscriptionService';

export type ProfilePlanLabelTone = 'default' | 'trial' | 'warning' | 'muted';

export interface ProfilePlanLabelResult {
  label: string;
  tone: ProfilePlanLabelTone;
}

export const PROFILE_PLAN_LABEL_TONE_STYLES: Record<ProfilePlanLabelTone, string> = {
  default: 'border-cyan-500/30 bg-slate-800 text-cyan-200',
  trial: 'border-cyan-400/40 bg-cyan-950/50 text-cyan-100',
  warning: 'border-amber-500/40 bg-amber-950/40 text-amber-200',
  muted: 'border-slate-600 bg-slate-800/80 text-slate-300',
};

/** Light/dark billing page variants of the profile plan label tones. */
export const BILLING_PLAN_LABEL_TONE_STYLES: Record<ProfilePlanLabelTone, string> = {
  default:
    'border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-950/40 dark:text-cyan-200',
  trial:
    'border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-400/40 dark:bg-cyan-950/50 dark:text-cyan-100',
  warning:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200',
  muted:
    'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300',
};

export interface SubscriptionLabelInput {
  plan: PlanId;
  status: string | null;
  subscription: SubscriptionRow | null;
}

export function getProfilePlanLabel(input: SubscriptionLabelInput): ProfilePlanLabelResult {
  const { plan, status, subscription } = input;
  const normalizedStatus = status?.toLowerCase() ?? null;

  if (normalizedStatus === 'past_due') {
    return { label: 'Past due', tone: 'warning' };
  }

  if (normalizedStatus === 'canceled' || normalizedStatus === 'cancelled') {
    return { label: 'Canceled', tone: 'muted' };
  }

  if (normalizedStatus === 'trialing') {
    return { label: 'Trial', tone: 'trial' };
  }

  if (!subscription) {
    return { label: 'Free', tone: 'muted' };
  }

  if (!subscription.stripeSubscriptionId) {
    return { label: 'Free', tone: 'muted' };
  }

  if (normalizedStatus && !isSubscriptionStatusActive(normalizedStatus)) {
    return { label: 'Canceled', tone: 'muted' };
  }

  return {
    label: `${PLAN_DISPLAY_NAMES[plan].short} plan`,
    tone: 'default',
  };
}

/** Customer-facing billing status text (not internal entitlement plan id). */
export function getBillingStatusLabel(input: SubscriptionLabelInput): string {
  const { status, subscription } = input;
  const normalizedStatus = status?.toLowerCase() ?? null;

  if (!subscription || !subscription.stripeSubscriptionId) {
    return 'No active subscription';
  }

  if (normalizedStatus === 'past_due') {
    return 'Past due';
  }

  if (normalizedStatus === 'canceled' || normalizedStatus === 'cancelled') {
    return 'Canceled';
  }

  if (normalizedStatus === 'trialing') {
    return 'Trialing';
  }

  if (normalizedStatus === 'incomplete' || normalizedStatus === 'incomplete_expired') {
    return 'Incomplete';
  }

  if (normalizedStatus === 'active') {
    return 'Active';
  }

  if (normalizedStatus) {
    return normalizedStatus.replace(/_/g, ' ');
  }

  return 'No active subscription';
}

/**
 * Paid tier highlighted as "current" on pricing cards.
 * Returns null for Free / no Stripe subscription users.
 */
export function getCustomerFacingCurrentPlanId(input: SubscriptionLabelInput): PlanId | null {
  const { plan, status, subscription } = input;

  if (!subscription?.stripeSubscriptionId) {
    return null;
  }

  const normalizedStatus = status?.toLowerCase() ?? null;

  if (
    normalizedStatus === 'canceled' ||
    normalizedStatus === 'cancelled' ||
    normalizedStatus === 'incomplete' ||
    normalizedStatus === 'incomplete_expired'
  ) {
    return null;
  }

  return plan;
}
