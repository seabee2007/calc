/** Public legal pages that share the logged-out marketing shell and footer. */
export const PUBLIC_LEGAL_PATHS = [
  '/privacy-policy',
  '/privacy',
  '/terms',
  '/contact',
] as const;

export function isPublicLegalPath(pathname: string): boolean {
  return PUBLIC_LEGAL_PATHS.includes(pathname as (typeof PUBLIC_LEGAL_PATHS)[number]);
}

/** Marketing-style public shell: homepage (logged out) and public legal pages. */
export function usesPublicMarketingShell(pathname: string, isLoggedOutHome: boolean): boolean {
  return isLoggedOutHome || isPublicLegalPath(pathname);
}
