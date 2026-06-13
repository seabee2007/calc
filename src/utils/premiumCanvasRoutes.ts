/** Routes that use the premium solid canvas (no concrete texture). */

const PREMIUM_CANVAS_PREFIXES = [
  '/projects',
  '/resources',
  '/planner/hub',
  '/proposals',
  '/proposal-generator',
  '/calculator',
  '/tools/',
  '/mix-design-advisor',
  '/pour-planner',
  '/settings',
  '/owner/review',
] as const;

export function usesPremiumCanvas(pathname: string): boolean {
  if (pathname === '/') return true;
  if (/^\/projects\/[^/]+\/planner(?:\/|$)/.test(pathname)) {
    return false;
  }
  return PREMIUM_CANVAS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}
