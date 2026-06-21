import {
  canUseFeature,
  getEffectiveLimits,
  isSubscriptionStatusActive,
  type PlanId,
} from '../lib/entitlements';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/fieldPlanner';
import { isEmployeeRole } from '../types/fieldPlanner';
import {
  fetchEmployeePortalAccess,
  logEmployeePortalAccessDiagnostics,
  type EmployeePortalAccessResult,
} from './employeePortalAccessService';
import { fetchProfile, fetchTeamProfiles } from './profileService';
import { fetchSubscription, resolveEffectivePlanFromRow } from './subscriptionService';

export type AccessResolutionState = 'idle' | 'loading' | 'resolved' | 'error';

export type { EmployeePortalAccessResult };

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
  isFieldEmployeeAccount: boolean;
  acceptedEmployeeMemberships: AcceptedEmployeeMembership[];
  employeePortalAccess: EmployeePortalAccessResult | null;
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

  if (hasOwnActiveSubscription || ownsWorkspaceProjects) {
    return { isOwner: true, isWorkspaceAdmin: false };
  }

  return { isOwner: false, isWorkspaceAdmin: false };
}

async function resolveAcceptedEmployeeMembershipsFromRpc(
  userId: string,
  profile: Profile,
  portalAccess: EmployeePortalAccessResult,
): Promise<AcceptedEmployeeMembership[]> {
  if (
    !portalAccess.employeeMembershipId ||
    !portalAccess.workspaceId ||
    !isEmployeeRole(profile.role)
  ) {
    return [];
  }

  const employerPlanId = portalAccess.employerPlanId;
  const employerFieldPortalEnabled = employerPlanId
    ? canUseFeature(employerPlanId, 'employee_portal')
    : false;

  return [
    {
      workspaceId: portalAccess.workspaceId,
      membershipId: portalAccess.employeeMembershipId,
      status: 'accepted',
      role: profile.role,
      hasAssignedFieldSeat: portalAccess.seatAssigned,
      employerPlanId,
      employerFieldPortalEnabled,
    },
  ];
}

/** Legacy client-side resolver when RPC is unavailable (local dev without migration). */
async function resolveAcceptedEmployeeMembershipsLegacy(
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

async function resolveEmployeePortalContext(
  userId: string,
  profile: Profile,
): Promise<{
  acceptedEmployeeMemberships: AcceptedEmployeeMembership[];
  employeePortalAccess: EmployeePortalAccessResult | null;
}> {
  const portalAccess = await fetchEmployeePortalAccess(true);

  if (portalAccess) {
    const acceptedEmployeeMemberships = await resolveAcceptedEmployeeMembershipsFromRpc(
      userId,
      profile,
      portalAccess,
    );
    return { acceptedEmployeeMemberships, employeePortalAccess: portalAccess };
  }

  const acceptedEmployeeMemberships = await resolveAcceptedEmployeeMembershipsLegacy(
    userId,
    profile,
  );
  return { acceptedEmployeeMemberships, employeePortalAccess: null };
}

export function resolveDefaultRouteFromAccess(
  access: Pick<
    ResolvedAppAccess,
    'isOwner' | 'isWorkspaceAdmin' | 'acceptedEmployeeMemberships' | 'isFieldEmployeeAccount'
  >,
): ResolvedAppAccess['defaultRoute'] {
  if (access.isOwner || access.isWorkspaceAdmin) {
    return '/dashboard';
  }

  if (access.acceptedEmployeeMemberships.length > 0 || access.isFieldEmployeeAccount) {
    return '/employee/dashboard';
  }

  return '/onboarding';
}

export async function resolveAppAccess(
  userId: string,
  profileInput?: Profile | null,
  options?: { authEmail?: string | null },
): Promise<ResolvedAppAccess> {
  const profile = profileInput ?? (await fetchProfile(userId));
  if (!profile) {
    return {
      userId,
      isOwner: false,
      isWorkspaceAdmin: false,
      isFieldEmployeeAccount: false,
      acceptedEmployeeMemberships: [],
      employeePortalAccess: null,
      defaultRoute: '/onboarding',
    };
  }

  const ownership = await resolveWorkspaceOwnership(userId, profile);
  let acceptedEmployeeMemberships: AcceptedEmployeeMembership[] = [];
  let employeePortalAccess: EmployeePortalAccessResult | null = null;
  const isFieldEmployeeAccount =
    !ownership.isOwner &&
    !ownership.isWorkspaceAdmin &&
    isEmployeeRole(profile.role) &&
    Boolean(profile.employerId);

  if (!ownership.isOwner && !ownership.isWorkspaceAdmin) {
    if (isEmployeeRole(profile.role) || profile.employerId) {
      const employeeContext = await resolveEmployeePortalContext(userId, profile);
      acceptedEmployeeMemberships = employeeContext.acceptedEmployeeMemberships;
      employeePortalAccess = employeeContext.employeePortalAccess;

      if (employeePortalAccess) {
        logEmployeePortalAccessDiagnostics({
          authUserId: userId,
          authEmail: options?.authEmail ?? null,
          acceptedMembershipId: employeePortalAccess.employeeMembershipId,
          workspaceId: employeePortalAccess.workspaceId,
          employerPlanId: employeePortalAccess.employerPlanId,
          seatAssigned: employeePortalAccess.seatAssigned,
          allowed: employeePortalAccess.allowed,
          reason: employeePortalAccess.reason,
        });
      }
    }
  }

  const resolved: ResolvedAppAccess = {
    userId,
    isOwner: ownership.isOwner,
    isWorkspaceAdmin: ownership.isWorkspaceAdmin,
    isFieldEmployeeAccount,
    acceptedEmployeeMemberships,
    employeePortalAccess,
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
  if (access?.employeePortalAccess) {
    return access.employeePortalAccess.allowed;
  }
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
