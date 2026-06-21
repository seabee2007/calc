/** Routes that use the premium solid canvas (no concrete texture). */

const PREMIUM_CANVAS_PREFIXES = [
  '/dashboard',
  '/projects',
  '/resources',
  '/planner/hub',
  '/proposals',
  '/proposal-generator',
  '/financials',
  '/calculator',
  '/tools/',
  '/mix-design-advisor',
  '/pour-planner',
  '/settings',
  '/accounting-tax',
  '/employees',
  '/owner/review',
] as const;

export function usesPremiumCanvas(pathname: string): boolean {
  if (pathname === '/' || pathname === '/dashboard') return true;
  if (/^\/projects\/[^/]+\/planner(?:\/|$)/.test(pathname)) {
    return false;
  }
  return PREMIUM_CANVAS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}
