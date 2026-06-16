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

export function getProfilePlanLabel(input: {
  plan: PlanId;
  status: string | null;
  subscription: SubscriptionRow | null;
}): ProfilePlanLabelResult {
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

  if (normalizedStatus && !isSubscriptionStatusActive(normalizedStatus)) {
    return { label: 'Canceled', tone: 'muted' };
  }

  if (plan === 'starter' && !subscription.stripeSubscriptionId) {
    return { label: 'Free', tone: 'muted' };
  }

  return {
    label: `${PLAN_DISPLAY_NAMES[plan].short} plan`,
    tone: 'default',
  };
}
