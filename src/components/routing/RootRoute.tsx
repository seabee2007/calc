import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAppAccess } from '../../contexts/AppAccessContext';
import AccessLoadingSurface from './AccessLoadingSurface';
import { AccessRedirect } from './AccessRedirect';
import MarketingHome from '../../pages/MarketingHome';
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
 * Only the deployed authenticated app host should hand signed-out visitors
 * back to the separate public marketing site.
 *
 * Local Vite development stays inside the local app at /login so local work
 * never jumps to production.
 */
function shouldRedirectSignedOutRootToMarketing(): boolean {
  if (import.meta.env.DEV || typeof window === 'undefined') {
    return false;
  }

  return window.location.hostname.toLowerCase() === 'app.ardenprojectos.com';
}

function SignedOutMarketingRedirect() {
  const redirectStartedRef = useRef(false);

  useEffect(() => {
    if (redirectStartedRef.current) {
      return;
    }

    const destination = new URL(getMarketingUrl());

    if (destination.origin === window.location.origin) {
      console.error(
        '[routing] VITE_MARKETING_URL must point to the separate public marketing site, not the app host.',
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
    profileFirstName: profile?.firstName ?? null,
    profileLastName: profile?.lastName ?? null,
    profileOnboardingCompletedAt: profile?.onboardingCompletedAt ?? null,
  });

  if (decision.type === 'loading') {
    return <AccessLoadingSurface />;
  }

  if (decision.accessKind === 'signed_out' && location.pathname === '/') {
    return <MarketingHome />;
  }

  if (
    decision.accessKind === 'signed_out' &&
    shouldRedirectSignedOutRootToMarketing()
  ) {
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
