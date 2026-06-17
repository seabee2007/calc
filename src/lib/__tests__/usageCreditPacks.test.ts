import { describe, it, expect } from 'vitest';
import {
  USAGE_CREDIT_PACKS,
  USAGE_CREDIT_PACK_LOOKUP_KEYS,
  canPurchaseCreditPacks,
  creditPackIdForUsageUnit,
  getUsageCreditPack,
  isUsageCreditPackId,
} from '../usageCreditPacks';

describe('USAGE_CREDIT_PACKS catalog', () => {
  it('ai_100: correct lookup key and single unit with 100 quantity', () => {
    const pack = USAGE_CREDIT_PACKS.ai_100;
    expect(pack.stripeLookupKey).toBe(USAGE_CREDIT_PACK_LOOKUP_KEYS.ai_request_pack_100);
    expect(pack.stripeLookupKey).toBe('arden_ai_request_pack_100');
    expect(pack.units).toHaveLength(1);
    expect(pack.units[0]).toEqual({ usageUnit: 'ai_request', quantity: 100 });
  });

  it('weather_map_500: correct lookup key and four units with 125 each (500 total)', () => {
    const pack = USAGE_CREDIT_PACKS.weather_map_500;
    expect(pack.stripeLookupKey).toBe(USAGE_CREDIT_PACK_LOOKUP_KEYS.weather_map_pack_500);
    expect(pack.stripeLookupKey).toBe('arden_weather_map_pack_500');
    expect(pack.units).toHaveLength(4);
    const total = pack.units.reduce((sum, u) => sum + u.quantity, 0);
    expect(total).toBe(500);
    const units = pack.units.map((u) => u.usageUnit);
    expect(units).toContain('weather_request');
    expect(units).toContain('geocode_request');
    expect(units).toContain('travel_request');
    expect(units).toContain('place_search');
    pack.units.forEach((u) => expect(u.quantity).toBe(125));
  });

  it('email_500: correct lookup key and single unit with 500 quantity', () => {
    const pack = USAGE_CREDIT_PACKS.email_500;
    expect(pack.stripeLookupKey).toBe(USAGE_CREDIT_PACK_LOOKUP_KEYS.email_send_pack_500);
    expect(pack.stripeLookupKey).toBe('arden_email_send_pack_500');
    expect(pack.units).toHaveLength(1);
    expect(pack.units[0]).toEqual({ usageUnit: 'email_send', quantity: 500 });
  });
});

describe('isUsageCreditPackId', () => {
  it('accepts valid pack IDs', () => {
    expect(isUsageCreditPackId('ai_100')).toBe(true);
    expect(isUsageCreditPackId('weather_map_500')).toBe(true);
    expect(isUsageCreditPackId('email_500')).toBe(true);
  });

  it('rejects invalid pack IDs', () => {
    expect(isUsageCreditPackId('ai_200')).toBe(false);
    expect(isUsageCreditPackId('')).toBe(false);
    expect(isUsageCreditPackId(null)).toBe(false);
    expect(isUsageCreditPackId(42)).toBe(false);
  });
});

describe('getUsageCreditPack', () => {
  it('returns correct pack definition', () => {
    const pack = getUsageCreditPack('ai_100');
    expect(pack.packId).toBe('ai_100');
    expect(pack.units[0].usageUnit).toBe('ai_request');
  });
});

describe('creditPackIdForUsageUnit', () => {
  it('ai_request → ai_100', () => {
    expect(creditPackIdForUsageUnit('ai_request')).toBe('ai_100');
  });

  it('weather/geocode/travel/place units → weather_map_500', () => {
    expect(creditPackIdForUsageUnit('weather_request')).toBe('weather_map_500');
    expect(creditPackIdForUsageUnit('geocode_request')).toBe('weather_map_500');
    expect(creditPackIdForUsageUnit('travel_request')).toBe('weather_map_500');
    expect(creditPackIdForUsageUnit('place_search')).toBe('weather_map_500');
  });

  it('email_send → email_500', () => {
    expect(creditPackIdForUsageUnit('email_send')).toBe('email_500');
  });
});

describe('canPurchaseCreditPacks', () => {
  it('returns false for free plan', () => {
    expect(canPurchaseCreditPacks('free')).toBe(false);
  });

  it('returns true for paid plans', () => {
    expect(canPurchaseCreditPacks('starter')).toBe(true);
    expect(canPurchaseCreditPacks('professional')).toBe(true);
    expect(canPurchaseCreditPacks('business')).toBe(true);
  });
});
