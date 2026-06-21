import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../contexts/SubscriptionContext';
import {
  FIELD_PORTAL_ACCESS_VERIFY_FAILED_MESSAGE,
} from '../../pages/auth/postAuthRouting';
import type { UserRole } from '../../types/fieldPlanner';
import { isEmployeeRole, isOwnerRole } from '../../types/fieldPlanner';
import { fetchTeamProfiles } from '../../services/profileService';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallbackTo?: string;
}

export default function RoleGuard({
  children,
  allowedRoles,
  fallbackTo = '/',
}: RoleGuardProps) {
  const { user, profile, loading, profileLoading } = useAuth();

  if (loading || profileLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-transparent">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-300" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile?.role) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ message: FIELD_PORTAL_ACCESS_VERIFY_FAILED_MESSAGE }}
      />
    );
  }

  const role = profile.role;
  if (!allowedRoles.includes(role)) {
    if (isEmployeeRole(role)) {
      return <Navigate to="/employee/dashboard" replace />;
    }
    if (isOwnerRole(role)) {
      return <Navigate to={fallbackTo} replace />;
    }
    return <Navigate to={fallbackTo} replace />;
  }

  return <>{children}</>;
}

export function OwnerGuard({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['owner', 'admin']} fallbackTo="/employee/dashboard">
      {children}
    </RoleGuard>
  );
}

export function EmployeeGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading: authLoading, profileLoading } = useAuth();
  const { hasFeature, getLimit, loading: subscriptionLoading } = useSubscription();
  const [seatCheck, setSeatCheck] = useState<{
    loading: boolean;
    allowed: boolean;
    reason: 'seat_limit' | 'membership_missing' | null;
  }>({ loading: true, allowed: false, reason: null });

  const employeePortalIncluded = hasFeature('employee_portal');

  useEffect(() => {
    let cancelled = false;

    async function resolveSeatAccess() {
      if (authLoading || profileLoading || subscriptionLoading) return;
      const employeeId = profile?.id;
      const employeeRole = profile?.role;
      const employerId = profile?.employerId;

      if (!user || !employeeId || !employeeRole || !isEmployeeRole(employeeRole) || !employeePortalIncluded) {
        if (!cancelled) setSeatCheck({ loading: false, allowed: false, reason: null });
        return;
      }
      if (!employerId) {
        if (!cancelled) setSeatCheck({ loading: false, allowed: false, reason: 'membership_missing' });
        return;
      }

      setSeatCheck((current) => ({ ...current, loading: true }));
      try {
        const teamProfiles = await fetchTeamProfiles(employerId);
        const seatLimit = getLimit('included_field_seats');
        const hasAcceptedMembership = teamProfiles.some((teamProfile) => teamProfile.id === employeeId);
        const withinSeatLimit = seatLimit < 0 || teamProfiles.length <= seatLimit;
        if (!cancelled) {
          setSeatCheck({
            loading: false,
            allowed: hasAcceptedMembership && withinSeatLimit,
            reason: hasAcceptedMembership && !withinSeatLimit ? 'seat_limit' : 'membership_missing',
          });
        }
      } catch {
        if (!cancelled) setSeatCheck({ loading: false, allowed: false, reason: 'membership_missing' });
      }
    }

    void resolveSeatAccess();
    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    employeePortalIncluded,
    getLimit,
    profile?.employerId,
    profile?.id,
    profile?.role,
    profileLoading,
    subscriptionLoading,
    user?.id,
  ]);

  if (authLoading || profileLoading || subscriptionLoading || seatCheck.loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-transparent">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-300" />
      </div>
    );
  }

  if (!user || !profile?.role || !isEmployeeRole(profile.role)) {
    return (
      <RoleGuard
        allowedRoles={['employee', 'foreman', 'project_manager']}
        fallbackTo="/"
      >
        {children}
      </RoleGuard>
    );
  }

  if (!employeePortalIncluded) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <EmployeePortalBlockedCard message="This feature is not included in your company’s plan. Contact your account owner." />
      </div>
    );
  }

  if (!seatCheck.allowed) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <EmployeePortalBlockedCard
          message={
            seatCheck.reason === 'seat_limit'
              ? 'Your company has reached its field-seat limit. Contact your account owner.'
              : 'This feature is not included in your company’s plan. Contact your account owner.'
          }
        />
      </div>
    );
  }

  return (
    <RoleGuard
      allowedRoles={['employee', 'foreman', 'project_manager']}
      fallbackTo="/"
    >
      {children}
    </RoleGuard>
  );
}

function EmployeePortalBlockedCard({ message }: { message: string }) {
  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      data-testid="employee-portal-blocked"
      role="alert"
    >
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Field portal unavailable</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>
    </div>
  );
}
