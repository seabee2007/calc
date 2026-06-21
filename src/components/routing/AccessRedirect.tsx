import { Navigate, useLocation } from 'react-router-dom';
import { logAppRoutingRedirect } from '../../lib/appRoutingDiagnostics';
import type { AccessResolutionState } from '../../services/appAccessService';

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

export function AccessRedirect({
  to,
  reason,
  authSessionResolved,
  accessResolutionState,
}: {
  to: string;
  reason: string;
  authSessionResolved: boolean;
  accessResolutionState: AccessResolutionState;
}) {
  const location = useLocation();
  const from = normalizePathname(location.pathname);
  const target = normalizePathname(to);

  if (from === target) {
    return null;
  }

  logAppRoutingRedirect({
    from: location.pathname,
    to,
    reason,
    authSessionResolved,
    accessResolutionState,
  });

  return <Navigate to={to} replace />;
}
