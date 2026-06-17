import { describe, expect, it } from 'vitest';
import {
  PLAN_USAGE_LIMITS,
  checkUsageAllowed,
  getPlanUsageLimit,
  getUsagePeriod,
  isUsageLimitReachedPayload,
  usageLimitMessage,
} from '../usageLimits';

describe('usageLimits', () => {
  it('defines monthly limits for every plan and unit', () => {
    const plans = ['free', 'starter', 'professional', 'business'] as const;
    const units = [
      'ai_request',
      'weather_request',
      'geocode_request',
      'travel_request',
      'place_search',
      'email_send',
    ] as const;

    for (const plan of plans) {
      for (const unit of units) {
        expect(typeof PLAN_USAGE_LIMITS[plan][unit]).toBe('number');
      }
    }
  });

  it('returns plan-specific limits', () => {
    expect(getPlanUsageLimit('free', 'ai_request')).toBe(0);
    expect(getPlanUsageLimit('business', 'ai_request')).toBe(1000);
  });

  it('blocks when used + quantity exceeds limit', () => {
    const atLimit = checkUsageAllowed({
      planId: 'starter',
      usageUnit: 'weather_request',
      used: 250,
      quantity: 1,
    });
    expect(atLimit.allowed).toBe(false);
    expect(atLimit.limit).toBe(250);
    expect(atLimit.used).toBe(250);
  });

  it('allows when under limit', () => {
    const ok = checkUsageAllowed({
      planId: 'starter',
      usageUnit: 'weather_request',
      used: 10,
      quantity: 1,
    });
    expect(ok.allowed).toBe(true);
    expect(ok.remaining).toBe(240);
  });

  it('computes UTC calendar month window', () => {
    const period = getUsagePeriod(new Date('2026-06-15T12:00:00.000Z'));
    expect(period.start).toBe('2026-06-01T00:00:00.000Z');
    expect(period.end).toBe('2026-07-01T00:00:00.000Z');
  });

  it('recognizes usage_limit_reached payloads', () => {
    expect(
      isUsageLimitReachedPayload({
        error: 'usage_limit_reached',
        featureKey: 'weather.forecast',
        usageUnit: 'weather_request',
        limit: 25,
        used: 25,
        planId: 'free',
        upgradeRequired: true,
      }),
    ).toBe(true);
    expect(isUsageLimitReachedPayload({ error: 'other' })).toBe(false);
  });

  it('provides user-facing limit messages by unit', () => {
    expect(usageLimitMessage('ai_request')).toMatch(/AI request limit/i);
    expect(usageLimitMessage('email_send')).toMatch(/email send limit/i);
  });
});
