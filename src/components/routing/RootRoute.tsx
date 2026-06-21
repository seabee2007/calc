import React, { useEffect, useRef } from 'react';
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

function getMarketingUrl(): string {
  const configuredUrl = import.meta.env.VITE_MARKETING_URL?.trim();

  return (configuredUrl || 'https://ardenprojectos.com').replace(/\/+$/, '');
}

/**
 * `/` exists on the authenticated app host. Signed-out visitors belong on the
 * separate public marketing host, not the internal `/login` route.
 *
 * `replace()` is intentional: when the browser Back button arrives at the app
 * root, replace that transient app-root history entry with the marketing page
 * instead of adding another entry that would create a back-navigation loop.
 */
function SignedOutMarketingRedirect() {
  const redirectStartedRef = useRef(false);

  useEffect(() => {
    if (redirectStartedRef.current) {
      return;
    }

    const destination = new URL(getMarketingUrl());

    // Never create a self-redirect loop if VITE_MARKETING_URL is misconfigured.
    if (
      destination.origin === window.location.origin &&
      destination.pathname === window.location.pathname
    ) {
      console.error(
        '[routing] VITE_MARKETING_URL points to the authenticated app root. ' +
          'Set it to the public marketing site, for example https://ardenprojectos.com.',
      );
      return;
    }

    redirectStartedRef.current = true;
    window.location.replace(destination.toString());
  }, []);

  return <AccessLoadingSurface message="Returning to Arden Project OS…" />;
}

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
    profileEmployerId: profile?.employerId ?? null,
    profileOnboardingCompletedAt: profile?.onboardingCompletedAt ?? null,
  });

  if (decision.type === 'loading') {
    return <AccessLoadingSurface />;
  }

  if (decision.accessKind === 'signed_out') {
    logRouteRedirect({
      from: location.pathname,
      to: getMarketingUrl(),
      reason: 'root-signed-out-to-marketing',
    });

    return <SignedOutMarketingRedirect />;
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
