import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAppAccess } from '../../contexts/AppAccessContext';
import AccessLoadingSurface from './AccessLoadingSurface';
import { AccessRedirect } from './AccessRedirect';
import {
  logRootRouteDiagnostics,
  logRouteRedirect,
} from '../../lib/appRoutingDiagnostics';
import {
  resolveRootAccessKind,
  resolveRootRouteTarget,
} from '../../lib/rootRouteResolver';

export default function RootRoute() {
  const { user, loading: authLoading, profileLoading, profile } = useAuth();
  const { access, accessResolutionState, authSessionResolved } = useAppAccess();
  const location = useLocation();

  const hasSession = Boolean(user);
  const accessLoading =
    hasSession &&
    (!authSessionResolved ||
      profileLoading ||
      accessResolutionState === 'idle' ||
      accessResolutionState === 'loading');

  const accessKind = resolveRootAccessKind({
    authLoading,
    hasSession,
    accessLoading,
    access,
  });

  logRootRouteDiagnostics({
    pathname: location.pathname,
    authLoading,
    hasSession,
    userId: user?.id ?? null,
    accessKind,
    accessLoading,
    accessResolutionState,
  });

  const decision = resolveRootRouteTarget({
    authLoading,
    hasSession,
    accessLoading,
    access,
    profileRole: profile?.role,
    profileOnboardingCompletedAt: profile?.onboardingCompletedAt ?? null,
  });

  if (decision.type === 'loading') {
    return <AccessLoadingSurface />;
  }

  logRouteRedirect({
    from: location.pathname,
    to: decision.to,
    reason: decision.reason,
  });

  return (
    <AccessRedirect
      to={decision.to}
      reason={decision.reason}
      authSessionResolved={authSessionResolved}
      accessResolutionState={accessResolutionState}
    />
  );
}
