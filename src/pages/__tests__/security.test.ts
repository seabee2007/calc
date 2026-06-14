/**
 * Security regression tests.
 *
 * Covers:
 * 1. Owner-only route configuration in App.tsx source
 * 2. Token URL helpers — no staging/marketing host leakage
 * 3. Public token pages — invalid token shows generic message, no raw error
 * 4. Netlify security headers present in netlify.toml
 * 5. Edge functions — auth guard present in source
 * 6. No client-side secrets in src/
 * 7. RLS migration for production_rate_sources exists
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';

const root = process.cwd();

// ── helpers ──────────────────────────────────────────────────────────────────

function readSrc(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

// ── 1. Route guard configuration ─────────────────────────────────────────────

describe('Owner-only route guards (App.tsx)', () => {
  const appSource = readSrc('src/App.tsx');

  // Helper: assert each sensitive path is wrapped with both AuthGuard and OwnerGuard
  const OWNER_ONLY_PATHS = [
    'proposal-generator',
    'proposals',
    'financials',
    'accounting-tax',
    'settings',
  ];

  for (const path of OWNER_ONLY_PATHS) {
    it(`"${path}" route has OwnerGuard`, () => {
      // Find the Route element for this path and verify OwnerGuard appears
      // between it and the next Route declaration.
      const routeIdx = appSource.indexOf(`path="${path}"`);
      expect(routeIdx, `Route for ${path} not found in App.tsx`).toBeGreaterThan(-1);

      // Grab the slice up to the next <Route element to scope the check.
      const nextRouteIdx = appSource.indexOf('<Route', routeIdx + 1);
      const routeBlock = appSource.slice(routeIdx, nextRouteIdx === -1 ? undefined : nextRouteIdx);

      expect(routeBlock).toContain('OwnerGuard');
      expect(routeBlock).toContain('AuthGuard');
    });
  }

  it('imports OwnerGuard from RoleGuard', () => {
    expect(appSource).toContain("import { OwnerGuard");
    expect(appSource).toMatch(/from ['"]\.\/components\/auth\/RoleGuard['"]/);
  });

  it('employee routes are behind EmployeeGuard', () => {
    // Locate employee/* route block
    const idx = appSource.indexOf('path="employee"');
    expect(idx).toBeGreaterThan(-1);
    const slice = appSource.slice(idx, appSource.indexOf('<Route', idx + 1));
    expect(slice).toContain('EmployeeGuard');
  });

  it('public token routes have no AuthGuard or OwnerGuard', () => {
    // Routes are defined with leading slash at the root level
    const publicTokenPaths = ['/proposal/:token', '/change-order/:token', '/contract/:token'];
    for (const path of publicTokenPaths) {
      const routeIdx = appSource.indexOf(`path="${path}"`);
      expect(routeIdx, `Route for ${path} missing`).toBeGreaterThan(-1);
      const nextRouteIdx = appSource.indexOf('<Route', routeIdx + 1);
      const block = appSource.slice(routeIdx, nextRouteIdx === -1 ? undefined : nextRouteIdx);
      expect(block).not.toContain('AuthGuard');
      expect(block).not.toContain('OwnerGuard');
    }
  });
});

// ── 2. Token URL helpers ──────────────────────────────────────────────────────

describe('getPublicProposalUrl — host guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses app host when on app host', async () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://app.ardenprojectos.com', hostname: 'app.ardenprojectos.com' },
    });
    const { getPublicProposalUrl } = await import('../../lib/proposalTracking');
    const url = getPublicProposalUrl('tok-123');
    expect(url).toBe('https://app.ardenprojectos.com/proposal/tok-123');
    // Must not use the marketing host (no-subdomain form)
    expect(url).not.toMatch(/^https:\/\/ardenprojectos\.com\//);
  });

  it('falls back to configured app URL on marketing host', async () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://ardenprojectos.com', hostname: 'ardenprojectos.com' },
    });
    const { getPublicProposalUrl } = await import('../../lib/proposalTracking');
    const url = getPublicProposalUrl('tok-456');
    expect(url).not.toContain('https://ardenprojectos.com/proposal');
    expect(url).toContain('/proposal/tok-456');
  });
});

// ── 3. Public token page — generic error messages ────────────────────────────

describe('Public token pages — error message safety', () => {
  it('PublicProposal does not expose Supabase error message to user', () => {
    const source = readSrc('src/pages/PublicProposal.tsx');
    // Raw .message from supabase errors should not be rendered directly
    expect(source).not.toMatch(/\{.*error\.message.*\}/);
    expect(source).not.toContain('{supabaseError}');
  });

  it('PublicProposal shows a non-distinguishing error for missing tokens', () => {
    const source = readSrc('src/pages/PublicProposal.tsx');
    // Should NOT have separate messages that distinguish "not found" from "not sent"
    // in a way that leaks record existence to unauthenticated visitors.
    // We look for the pattern "not found" — our hardening goal is to converge to one message.
    // This test documents the current state and fails if raw "not found" starts appearing.
    expect(source).not.toContain('Proposal not found');
    expect(source).not.toContain('Record not found');
  });

  it('PublicContractPage does not render raw Supabase error', () => {
    const source = readSrc('src/features/documents/ui/PublicContractPage.tsx');
    expect(source).not.toMatch(/\{.*error\.message.*\}/);
    expect(source).not.toContain('{supabaseError}');
  });
});

// ── 4. Netlify security headers ──────────────────────────────────────────────

describe('netlify.toml security headers', () => {
  const toml = readSrc('netlify.toml');

  it('has Strict-Transport-Security', () => {
    expect(toml).toContain('Strict-Transport-Security');
    expect(toml).toContain('max-age=');
    expect(toml).toContain('includeSubDomains');
  });

  it('has Permissions-Policy', () => {
    expect(toml).toContain('Permissions-Policy');
  });

  it('has Content-Security-Policy', () => {
    expect(toml).toContain('Content-Security-Policy');
    expect(toml).toContain("default-src 'self'");
  });

  it('has X-Frame-Options DENY', () => {
    expect(toml).toContain('X-Frame-Options');
    expect(toml).toContain('DENY');
  });

  it('has X-Content-Type-Options', () => {
    expect(toml).toContain('X-Content-Type-Options');
    expect(toml).toContain('nosniff');
  });

  it('CSP does not allow frame-ancestors from unknown origins', () => {
    const cspLine = toml.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)?.[1] ?? '';
    expect(cspLine).toContain("frame-ancestors 'none'");
  });
});

// ── 5. Edge function auth guard ───────────────────────────────────────────────

describe('Edge functions — requireAuth guard present', () => {
  const PAID_PROXY_FUNCTIONS = [
    'supabase/functions/askConcrete/index.ts',
    'supabase/functions/summarize-project-scope/index.ts',
    'supabase/functions/geocode-address/index.ts',
    'supabase/functions/getWeatherForecast/index.ts',
    'supabase/functions/labor-crew-review/index.ts',
    'supabase/functions/batch-plant-contact/index.ts',
    'supabase/functions/batch-plant-pricing/index.ts',
  ];

  for (const fn of PAID_PROXY_FUNCTIONS) {
    it(`${fn} imports and calls requireAuth`, () => {
      const source = readSrc(fn);
      expect(source, `${fn} missing requireAuth import`).toContain('requireAuth');
      expect(source, `${fn} missing requireAuth call`).toContain('await requireAuth(req');
      expect(source, `${fn} missing early return on auth failure`).toContain(
        "if (!authResult.ok) return authResult.response",
      );
    });
  }

  it('requireAuth shared helper exists and exports the function', () => {
    const source = readSrc('supabase/functions/_shared/requireAuth.ts');
    expect(source).toContain('export async function requireAuth');
    expect(source).toContain('Authorization');
    expect(source).toContain('getUser');
  });

  it('send-transactional-email still requires JWT', () => {
    const source = readSrc('supabase/functions/send-transactional-email/index.ts');
    expect(source).toMatch(/Authorization|getUser|requireAuth/);
  });
});

// ── 6. No client-side secrets ─────────────────────────────────────────────────

describe('No hardcoded secrets in src/', () => {
  // We read App.tsx and config/brand.ts as representative high-visibility files.
  // Full repo scans are run by the CI secret-scanner.

  it('App.tsx contains no service_role key reference', () => {
    const source = readSrc('src/App.tsx');
    expect(source).not.toContain('service_role');
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE');
  });

  it('brand.ts contains no hardcoded API keys', () => {
    const source = readSrc('src/config/brand.ts');
    expect(source).not.toMatch(/sk-[a-zA-Z0-9]{10,}/);
    expect(source).not.toMatch(/re_[a-zA-Z0-9]{10,}/);
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE');
  });

  it('supabase client init does not use service role key', () => {
    const source = readSrc('src/lib/supabase.ts');
    expect(source).not.toContain('service_role');
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE');
  });
});

// ── 7. RLS migration for production_rate_sources ─────────────────────────────

describe('Security hardening migration', () => {
  it('migration file exists for security hardening RLS', () => {
    const source = readSrc('supabase/migrations/20260615000001_security_hardening_rls.sql');
    expect(source).toContain('production_rate_sources');
    expect(source).toContain('ENABLE ROW LEVEL SECURITY');
  });

  it('redacted proposal RPC exists in hardening migration', () => {
    const source = readSrc('supabase/migrations/20260615000001_security_hardening_rls.sql');
    expect(source).toContain('get_proposal_by_public_token');
    expect(source).toContain('jsonb_build_object');
    // Must NOT select the raw proposals row type
    expect(source).not.toContain('RETURNS proposals');
  });

  it('redacted change-order RPC exists and strips markup', () => {
    const source = readSrc('supabase/migrations/20260615000001_security_hardening_rls.sql');
    expect(source).toContain('get_change_order_by_public_token');
    // to_jsonb(co) returns full row — should not be present in the new version
    expect(source).not.toContain('to_jsonb(co)');
    expect(source).toContain("- 'unit_cost'");
    expect(source).toContain("- 'markup_amount'");
  });
});
