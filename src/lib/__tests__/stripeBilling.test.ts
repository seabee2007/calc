import { describe, expect, it } from 'vitest';
import {
  checkoutLookupKey,
  LOOKUP_KEY_TO_PLAN,
  parseBillingInterval,
  resolvePlanFromStripeEvent,
  resolvePlanFromStripeLookupKey,
  validateCheckoutRequest,
} from '../stripeBilling';
import { STRIPE_PRICE_LOOKUP_KEYS } from '../stripeConfig';

describe('stripeBilling', () => {
  it('maps checkout plan and interval to Stripe lookup keys', () => {
    expect(checkoutLookupKey('starter', 'month')).toBe(STRIPE_PRICE_LOOKUP_KEYS.starter_monthly);
    expect(checkoutLookupKey('professional', 'year')).toBe(
      STRIPE_PRICE_LOOKUP_KEYS.professional_annual,
    );
    expect(checkoutLookupKey('business', 'month')).toBe(STRIPE_PRICE_LOOKUP_KEYS.business_monthly);
  });

  it('rejects invalid plan ids', () => {
    expect(validateCheckoutRequest({ planId: 'enterprise', billingInterval: 'month' })).toEqual({
      error: 'Invalid planId. Expected starter, professional, or business.',
    });
  });

  it('rejects invalid billing intervals', () => {
    expect(validateCheckoutRequest({ planId: 'starter', billingInterval: 'weekly' })).toEqual({
      error: 'Invalid billingInterval. Expected month or year.',
    });
  });

  it('accepts valid checkout requests', () => {
    expect(validateCheckoutRequest({ planId: 'professional', billingInterval: 'year' })).toEqual({
      planId: 'professional',
      billingInterval: 'year',
    });
  });

  it('maps Stripe price lookup keys to plan ids for webhook events', () => {
    expect(resolvePlanFromStripeLookupKey(STRIPE_PRICE_LOOKUP_KEYS.business_monthly)).toBe('business');
    expect(resolvePlanFromStripeLookupKey(STRIPE_PRICE_LOOKUP_KEYS.extra_field_seat)).toBeNull();
    expect(resolvePlanFromStripeLookupKey('unknown_price')).toBeNull();
  });

  it('prefers lookup key over metadata for webhook plan resolution', () => {
    expect(
      resolvePlanFromStripeEvent({
        priceLookupKey: STRIPE_PRICE_LOOKUP_KEYS.professional_monthly,
        metadataPlanId: 'business',
      }),
    ).toBe('professional');
  });

  it('falls back to metadata when lookup key is unknown', () => {
    expect(
      resolvePlanFromStripeEvent({
        priceLookupKey: 'unknown_addon',
        metadataPlanId: 'business',
      }),
    ).toBe('business');
  });

  it('ignores invalid metadata when lookup key is unknown', () => {
    expect(
      resolvePlanFromStripeEvent({
        priceLookupKey: null,
        metadataPlanId: 'enterprise',
      }),
    ).toBeNull();
  });

  it('keeps LOOKUP_KEY_TO_PLAN aligned with stripeConfig keys', () => {
    expect(Object.keys(LOOKUP_KEY_TO_PLAN).sort()).toEqual(
      [
        STRIPE_PRICE_LOOKUP_KEYS.starter_monthly,
        STRIPE_PRICE_LOOKUP_KEYS.starter_annual,
        STRIPE_PRICE_LOOKUP_KEYS.professional_monthly,
        STRIPE_PRICE_LOOKUP_KEYS.professional_annual,
        STRIPE_PRICE_LOOKUP_KEYS.business_monthly,
        STRIPE_PRICE_LOOKUP_KEYS.business_annual,
      ].sort(),
    );
  });

  it('normalizes monthly and annual interval aliases', () => {
    expect(parseBillingInterval('month')).toBe('month');
    expect(parseBillingInterval('monthly')).toBe('month');
    expect(parseBillingInterval('year')).toBe('year');
    expect(parseBillingInterval('annual')).toBe('year');
  });
});
