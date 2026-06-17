import { describe, expect, it } from 'vitest';
import {
  detectStripeKeyMode,
  isLocalAppUrl,
  stripeKeyModesMatch,
  validateClientStripePublishableKey,
} from '../stripeEnv';

describe('stripeEnv', () => {
  it('detects test and live Stripe key prefixes', () => {
    expect(detectStripeKeyMode('pk_test_abc')).toBe('test');
    expect(detectStripeKeyMode('sk_test_abc')).toBe('test');
    expect(detectStripeKeyMode('pk_live_abc')).toBe('live');
    expect(detectStripeKeyMode('sk_live_abc')).toBe('live');
    expect(detectStripeKeyMode('whsec_abc')).toBeNull();
    expect(detectStripeKeyMode('')).toBeNull();
  });

  it('requires publishable and secret keys to share the same mode', () => {
    expect(stripeKeyModesMatch('pk_test_x', 'sk_test_x')).toBe(true);
    expect(stripeKeyModesMatch('pk_live_x', 'sk_live_x')).toBe(true);
    expect(stripeKeyModesMatch('pk_test_x', 'sk_live_x')).toBe(false);
    expect(stripeKeyModesMatch('pk_live_x', 'sk_test_x')).toBe(false);
  });

  it('warns when a production build uses a test publishable key', () => {
    expect(validateClientStripePublishableKey('pk_test_abc', true)).toMatch(/test publishable key/i);
    expect(validateClientStripePublishableKey('pk_live_abc', true)).toBeNull();
    expect(validateClientStripePublishableKey('pk_test_abc', false)).toBeNull();
  });

  it('flags invalid publishable key prefixes', () => {
    expect(validateClientStripePublishableKey('invalid', false)).toMatch(/pk_test_ or pk_live_/);
  });

  it('detects localhost app URLs', () => {
    expect(isLocalAppUrl('http://localhost:5173')).toBe(true);
    expect(isLocalAppUrl('https://app.ardenprojectos.com')).toBe(false);
  });
});
