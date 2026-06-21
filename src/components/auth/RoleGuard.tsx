import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAppAccess } from '../../contexts/AppAccessContext';
import {
  FIELD_PORTAL_ACCESS_VERIFY_FAILED_MESSAGE,
} from '../../pages/auth/postAuthRouting';
import type { UserRole } from '../../types/fieldPlanner';
import { isOwnerRole } from '../../types/fieldPlanner';
import { isOwnerAppAccess } from '../../lib/appAccessRouting';
import AccessLoadingSurface from '../routing/AccessLoadingSurface';
import { AccessRedirect } from '../routing/AccessRedirect';
import AuthenticatedSessionPrompt from './AuthenticatedSessionPrompt';
import {
  employeePortalBlockedMessage,
  employeePortalBlockedTitle,
  resolveEmployeePortalAccess,
} from '../../lib/employeePortalAccess';
import { resolveEmployeePortalState } from '../../lib/employeeOnboarding';
import { resolvePostLoginRoute } from '../../lib/appAccessRouting';

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
  const { access, accessResolutionState, authSessionResolved } = useAppAccess();

  if (loading || profileLoading || !authSessionResolved || accessResolutionState === 'loading') {
    return <AccessLoadingSurface />;
  }

  if (!user) {
    return (
      <AccessRedirect
        to="/login"
        reason="role-guard-unauthenticated"
        authSessionResolved={authSessionResolved}
        accessResolutionState={accessResolutionState}
      />
    );
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

  if (accessResolutionState !== 'resolved' || !access) {
    return <AccessLoadingSurface />;
  }

  const role = profile.role;
  if (allowedRoles.includes(role)) {
    return <>{children}</>;
  }

  if (isOwnerAppAccess(access)) {
    return (
      <AccessRedirect
        to="/dashboard"
        reason="role-guard-owner-default"
        authSessionResolved={authSessionResolved}
        accessResolutionState={accessResolutionState}
      />
    );
  }

  if (access.defaultRoute === '/employee/dashboard') {
    return (
      <AccessRedirect
        to="/employee/dashboard"
        reason="role-guard-employee-default"
        authSessionResolved={authSessionResolved}
        accessResolutionState={accessResolutionState}
      />
    );
  }

  if (isOwnerRole(role)) {
    return <Navigate to={fallbackTo} replace />;
  }

  return <Navigate to={fallbackTo} replace />;
}

export function OwnerGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, profileLoading } = useAuth();
  const { access, accessResolutionState, authSessionResolved } = useAppAccess();

  if (loading || profileLoading || !authSessionResolved || accessResolutionState === 'loading') {
    return <AccessLoadingSurface />;
  }

  if (!user) {
    return (
      <AccessRedirect
        to="/login"
        reason="owner-guard-unauthenticated"
        authSessionResolved={authSessionResolved}
        accessResolutionState={accessResolutionState}
      />
    );
  }

  if (accessResolutionState !== 'resolved' || !access) {
    return <AccessLoadingSurface />;
  }

  if (isOwnerAppAccess(access)) {
    return <>{children}</>;
  }

  if (access.defaultRoute === '/employee/dashboard') {
    return (
      <AccessRedirect
        to="/employee/dashboard"
        reason="owner-guard-employee-redirect"
        authSessionResolved={authSessionResolved}
        accessResolutionState={accessResolutionState}
      />
    );
  }

  if (access.acceptedEmployeeMemberships.length > 0) {
    return (
      <AccessRedirect
        to="/employee/dashboard"
        reason="owner-guard-employee-membership"
        authSessionResolved={authSessionResolved}
        accessResolutionState={accessResolutionState}
      />
    );
  }

  return (
    <AccessRedirect
      to="/onboarding"
      reason="owner-guard-unassigned"
      authSessionResolved={authSessionResolved}
      accessResolutionState={accessResolutionState}
    />
  );
}

export function EmployeeGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, profileLoading, profile } = useAuth();
  const { access, accessResolutionState, authSessionResolved } = useAppAccess();

  const accessLoading =
    accessResolutionState === 'idle' ||
    accessResolutionState === 'loading' ||
    !authSessionResolved;

  if (authLoading || profileLoading || accessLoading) {
    return <AccessLoadingSurface />;
  }

  if (!user) {
    return (
      <AccessRedirect
        to="/login"
        reason="employee-guard-unauthenticated"
        authSessionResolved={authSessionResolved}
        accessResolutionState={accessResolutionState}
      />
    );
  }

  if (accessResolutionState === 'error') {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <EmployeePortalBlockedCard
          message={employeePortalBlockedMessage('access_resolution_failed')}
        />
      </div>
    );
  }

  if (accessResolutionState !== 'resolved' || !access) {
    return <AccessLoadingSurface />;
  }

  if (isOwnerAppAccess(access)) {
    return (
      <AccessRedirect
        to="/dashboard"
        reason="employee-guard-owner-redirect"
        authSessionResolved={authSessionResolved}
        accessResolutionState={accessResolutionState}
      />
    );
  }

  const portalAccess = resolveEmployeePortalAccess(access, false);
  const portalState = resolveEmployeePortalState({
    authLoading,
    profileLoading,
    accessLoading: false,
    portalAllowed: portalAccess.allowed,
    profile,
  });

  if (portalState === 'needs_employee_onboarding') {
    return (
      <AccessRedirect
        to="/employee/onboarding"
        reason="employee-guard-onboarding"
        authSessionResolved={authSessionResolved}
        accessResolutionState={accessResolutionState}
      />
    );
  }

  if (portalState === 'denied') {
    if (portalAccess.reason === 'owner_or_admin') {
      return (
        <AccessRedirect
          to="/dashboard"
          reason="employee-guard-owner-role"
          authSessionResolved={authSessionResolved}
          accessResolutionState={accessResolutionState}
        />
      );
    }

    return (
      <div className="mx-auto max-w-2xl p-6">
        <EmployeePortalBlockedCard
          title={employeePortalBlockedTitle(portalAccess.reason)}
          message={employeePortalBlockedMessage(portalAccess.reason)}
          membershipRemoved={portalAccess.reason === 'membership_removed'}
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

function EmployeePortalBlockedCard({
  message,
  title = 'Field portal unavailable',
  membershipRemoved = false,
}: {
  message: string;
  title?: string;
  membershipRemoved?: boolean;
}) {
  const { access } = useAppAccess();
  const continueHref = membershipRemoved ? '/login' : access ? resolvePostLoginRoute(access) : '/login';
  const continueLabel = membershipRemoved ? 'Sign in with a different account' : 'Try again';

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      data-testid="employee-portal-blocked"
      role="alert"
    >
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>
      <div className="mt-4">
        <AuthenticatedSessionPrompt
          continueHref={continueHref}
          continueLabel={continueLabel}
        />
      </div>
    </div>
  );
}
