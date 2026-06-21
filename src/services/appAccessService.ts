import {
  canUseFeature,
  getEffectiveLimits,
  isSubscriptionStatusActive,
  type PlanId,
} from '../lib/entitlements';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/fieldPlanner';
import { isEmployeeRole, isOwnerRole } from '../types/fieldPlanner';
import { fetchProfile, fetchTeamProfiles } from './profileService';
import { fetchSubscription, resolveEffectivePlanFromRow } from './subscriptionService';

export type AccessResolutionState = 'idle' | 'loading' | 'resolved' | 'error';

export type AcceptedEmployeeMembership = {
  workspaceId: string;
  membershipId: string;
  status: 'accepted';
  role: string;
  hasAssignedFieldSeat: boolean;
  employerPlanId: PlanId | null;
  employerFieldPortalEnabled: boolean;
};

export type ResolvedAppAccess = {
  userId: string;
  isOwner: boolean;
  isWorkspaceAdmin: boolean;
  acceptedEmployeeMemberships: AcceptedEmployeeMembership[];
  defaultRoute: '/dashboard' | '/employee/dashboard' | '/onboarding';
};

async function countOwnedProjects(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('projects')) return 0;
    throw error;
  }
  return count ?? 0;
}

async function resolveWorkspaceOwnership(
  userId: string,
  profile: Profile,
): Promise<{ isOwner: boolean; isWorkspaceAdmin: boolean }> {
  if (profile.role === 'owner') {
    return { isOwner: true, isWorkspaceAdmin: false };
  }
  if (profile.role === 'admin') {
    return { isOwner: false, isWorkspaceAdmin: true };
  }

  const [subscription, ownedProjectCount] = await Promise.all([
    fetchSubscription(userId).catch(() => null),
    countOwnedProjects(userId).catch(() => 0),
  ]);

  const hasOwnActiveSubscription = Boolean(
    subscription && isSubscriptionStatusActive(subscription.status),
  );
  const ownsWorkspaceProjects = ownedProjectCount > 0;

  // Live workspace ownership wins over profile.role/employerId — an account with its
  // own active subscription or owned projects is always treated as owner/admin-priority.
  if (hasOwnActiveSubscription || ownsWorkspaceProjects) {
    return { isOwner: true, isWorkspaceAdmin: false };
  }

  return { isOwner: false, isWorkspaceAdmin: false };
}

async function resolveAcceptedEmployeeMemberships(
  userId: string,
  profile: Profile,
): Promise<AcceptedEmployeeMembership[]> {
  if (!isEmployeeRole(profile.role) || !profile.employerId) {
    return [];
  }

  const workspaceId = profile.employerId;
  const teamProfiles = await fetchTeamProfiles(workspaceId);
  const acceptedMembership = teamProfiles.find((member) => member.id === userId);
  if (!acceptedMembership) {
    return [];
  }

  const subscription = await fetchSubscription(workspaceId).catch(() => null);
  const employerPlanId = subscription ? resolveEffectivePlanFromRow(subscription) : null;
  const limits = getEffectiveLimits(employerPlanId ?? 'free', {
    activeProjectLimit: subscription?.activeProjectLimit,
    includedFieldSeats: subscription?.includedFieldSeats,
  });
  const seatLimit = limits.included_field_seats;
  const teamIndex = teamProfiles.findIndex((member) => member.id === userId);
  const hasAssignedFieldSeat =
    teamIndex >= 0 && (seatLimit < 0 || teamIndex < seatLimit);
  const employerFieldPortalEnabled = employerPlanId
    ? canUseFeature(employerPlanId, 'employee_portal')
    : false;

  return [
    {
      workspaceId,
      membershipId: acceptedMembership.id,
      status: 'accepted',
      role: acceptedMembership.role,
      hasAssignedFieldSeat,
      employerPlanId,
      employerFieldPortalEnabled,
    },
  ];
}

export function resolveDefaultRouteFromAccess(
  access: Pick<
    ResolvedAppAccess,
    'isOwner' | 'isWorkspaceAdmin' | 'acceptedEmployeeMemberships'
  >,
): ResolvedAppAccess['defaultRoute'] {
  if (access.isOwner || access.isWorkspaceAdmin) {
    return '/dashboard';
  }

  if (access.acceptedEmployeeMemberships.length > 0) {
    return '/employee/dashboard';
  }

  return '/onboarding';
}

export async function resolveAppAccess(
  userId: string,
  profileInput?: Profile | null,
): Promise<ResolvedAppAccess> {
  const profile = profileInput ?? (await fetchProfile(userId));
  if (!profile) {
    return {
      userId,
      isOwner: false,
      isWorkspaceAdmin: false,
      acceptedEmployeeMemberships: [],
      defaultRoute: '/onboarding',
    };
  }

  const ownership = await resolveWorkspaceOwnership(userId, profile);
  const acceptedEmployeeMemberships =
    ownership.isOwner || ownership.isWorkspaceAdmin
      ? []
      : await resolveAcceptedEmployeeMemberships(userId, profile);

  const resolved: ResolvedAppAccess = {
    userId,
    isOwner: ownership.isOwner,
    isWorkspaceAdmin: ownership.isWorkspaceAdmin,
    acceptedEmployeeMemberships,
    defaultRoute: '/onboarding',
  };
  resolved.defaultRoute = resolveDefaultRouteFromAccess(resolved);
  return resolved;
}

export function isOwnerAppAccess(access: ResolvedAppAccess | null | undefined): boolean {
  return Boolean(access?.isOwner || access?.isWorkspaceAdmin);
}

export function hasEligibleEmployeePortalAccess(
  access: ResolvedAppAccess | null | undefined,
): boolean {
  return access?.defaultRoute === '/employee/dashboard';
}

/** Pending invites never create employee portal access — only accepted team profiles do. */
export function accessInputIsPendingEmployeeInvite(profile: Pick<Profile, 'role' | 'employerId'>): boolean {
  return isEmployeeRole(profile.role) && !profile.employerId;
}

export function subscriptionOwnerIdFromAccess(
  userId: string | undefined,
  access: ResolvedAppAccess | null | undefined,
): string | null {
  if (!userId || !access) return null;
  if (access.isOwner || access.isWorkspaceAdmin) return userId;
  return access.acceptedEmployeeMemberships[0]?.workspaceId ?? null;
}
