/**
 * Stripe test/live mode helpers — shared by frontend config checks and unit tests.
 * Edge functions mirror this logic in `supabase/functions/_shared/stripe.ts`.
 */

export type StripeKeyMode = 'test' | 'live';

export function detectStripeKeyMode(key: string | null | undefined): StripeKeyMode | null {
  if (!key || typeof key !== 'string') return null;
  if (key.startsWith('sk_test_') || key.startsWith('pk_test_')) return 'test';
  if (key.startsWith('sk_live_') || key.startsWith('pk_live_')) return 'live';
  return null;
}

/** True when publishable and secret keys are both present and the same mode. */
export function stripeKeyModesMatch(
  publishableKey: string | null | undefined,
  secretKey: string | null | undefined,
): boolean {
  const publishableMode = detectStripeKeyMode(publishableKey);
  const secretMode = detectStripeKeyMode(secretKey);
  if (!publishableMode || !secretMode) return false;
  return publishableMode === secretMode;
}

/**
 * Frontend sanity check — warns when production build uses test publishable key.
 * Does not throw; server-side pairing is enforced in edge functions.
 */
export function validateClientStripePublishableKey(
  publishableKey: string | null | undefined,
  isProductionBuild = import.meta.env.PROD,
): string | null {
  if (!publishableKey) return null;
  const mode = detectStripeKeyMode(publishableKey);
  if (!mode) {
    return 'VITE_STRIPE_PUBLISHABLE_KEY must start with pk_test_ or pk_live_.';
  }
  if (isProductionBuild && mode === 'test') {
    return 'Production build is using a Stripe test publishable key (pk_test_). Switch to pk_live_ before go-live.';
  }
  return null;
}

export function isLocalAppUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}
