import { supabase } from '../lib/supabase';
import { canUseFeature, type FeatureKey, type PlanId } from '../lib/entitlements';
import { isOwnerRole, type UserRole } from '../types/fieldPlanner';
import {
  fetchEntitlementForUser,
  type ResolvedEntitlement,
} from './subscriptionService';

async function resolveSubscriptionOwnerId(userId: string): Promise<string | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, employer_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!profile) {
    return userId;
  }

  const role = profile.role as UserRole;
  if (isOwnerRole(role)) {
    return userId;
  }

  return profile.employer_id ? String(profile.employer_id) : userId;
}

export async function resolveCurrentUserPlan(): Promise<PlanId | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const ownerId = await resolveSubscriptionOwnerId(user.id);
  if (!ownerId) {
    return null;
  }

  const entitlement = await fetchEntitlementForUser(ownerId);
  return entitlement.planId;
}

export async function resolveCurrentUserEntitlement(): Promise<ResolvedEntitlement | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const ownerId = await resolveSubscriptionOwnerId(user.id);
  if (!ownerId) {
    return null;
  }

  return fetchEntitlementForUser(ownerId);
}

export async function currentUserHasFeature(feature: FeatureKey): Promise<boolean> {
  const plan = await resolveCurrentUserPlan();
  return canUseFeature(plan, feature);
}

export async function assertCurrentUserHasFeature(feature: FeatureKey): Promise<void> {
  const allowed = await currentUserHasFeature(feature);
  if (!allowed) {
    throw new Error('Upgrade required to use this feature.');
  }
}
