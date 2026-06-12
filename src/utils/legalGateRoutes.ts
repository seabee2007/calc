/**
 * Routes that must remain reachable without legal acceptance.
 * Used by the authenticated legal gate in App.tsx.
 */
const LEGAL_GATE_BYPASS_PREFIXES = [
  '/terms',
  '/privacy',
  '/proposal/',
  '/change-order/',
  '/contract/',
  '/client/project/',
  '/invite/',
  '/login',
  '/signup',
  '/auth/callback',
  '/reset-password',
] as const;

export function isLegalGateBypassRoute(pathname: string): boolean {
  return LEGAL_GATE_BYPASS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}
