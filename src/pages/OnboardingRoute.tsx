import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAppAccess } from '../contexts/AppAccessContext';
import AccessLoadingSurface from '../components/routing/AccessLoadingSurface';
import { isOwnerAppAccess } from '../lib/appAccessRouting';
import { ownerNeedsOnboarding } from '../lib/rootRouteResolver';
import { isEmployeeRole } from '../types/fieldPlanner';

/**
 * Owner/new-workspace onboarding entry. Never evaluates employee portal entitlements.
 * App.tsx renders LazyOnboardingFlow when this route is active for eligible owners.
 */
export default function OnboardingRoute() {
  const { user, loading: authLoading, profileLoading, profile } = useAuth();
  const { access, accessResolutionState, authSessionResolved } = useAppAccess();

  if (authLoading || !authSessionResolved) {
    return <AccessLoadingSurface />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (
    profileLoading ||
    accessResolutionState === 'idle' ||
    accessResolutionState === 'loading' ||
    !access
  ) {
    return <AccessLoadingSurface />;
  }

  if (access.acceptedEmployeeMemberships.length > 0 && !isOwnerAppAccess(access)) {
    return <Navigate to="/employee/dashboard" replace />;
  }

  if (profile?.role && isEmployeeRole(profile.role)) {
    return <Navigate to="/employee/dashboard" replace />;
  }

  if (isOwnerAppAccess(access) && !ownerNeedsOnboarding({
    profileRole: profile?.role,
    profileOnboardingCompletedAt: profile?.onboardingCompletedAt ?? null,
  })) {
    return <Navigate to="/dashboard" replace />;
  }

  return <AccessLoadingSurface message="Setting up your workspace…" />;
}
