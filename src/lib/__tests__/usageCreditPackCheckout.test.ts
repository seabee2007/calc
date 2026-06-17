import { describe, it, expect } from 'vitest';
import {
  buildCreditPackInsertRows,
  buildUsageCreditPackCheckoutMetadata,
  parsePackUnitsFromMetadata,
  resolveCreditPackUnitsFromCheckoutMetadata,
} from '../usageCreditPackCheckout';

const BASE_METADATA = {
  type: 'usage_credit_pack' as const,
  pack_id: 'ai_100',
  user_id: 'user-123',
  employer_id: 'employer-456',
  expires_at: '2026-07-01T00:00:00.000Z',
  pack_units: JSON.stringify([{ usageUnit: 'ai_request', quantity: 100 }]),
};

describe('buildUsageCreditPackCheckoutMetadata', () => {
  it('serialises pack units to JSON string', () => {
    const meta = buildUsageCreditPackCheckoutMetadata({
      packId: 'ai_100',
      userId: 'user-123',
      employerId: 'employer-456',
      expiresAt: '2026-07-01T00:00:00.000Z',
      units: [{ usageUnit: 'ai_request', quantity: 100 }],
    });
    expect(meta.type).toBe('usage_credit_pack');
    expect(meta.pack_id).toBe('ai_100');
    const parsed = JSON.parse(meta.pack_units);
    expect(parsed).toEqual([{ usageUnit: 'ai_request', quantity: 100 }]);
  });
});

describe('parsePackUnitsFromMetadata', () => {
  it('parses valid JSON array', () => {
    const result = parsePackUnitsFromMetadata(
      JSON.stringify([{ usageUnit: 'ai_request', quantity: 100 }]),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ usageUnit: 'ai_request', quantity: 100 });
  });

  it('returns empty array for null/undefined', () => {
    expect(parsePackUnitsFromMetadata(null)).toHaveLength(0);
    expect(parsePackUnitsFromMetadata(undefined)).toHaveLength(0);
    expect(parsePackUnitsFromMetadata('')).toHaveLength(0);
  });

  it('returns empty array for invalid JSON', () => {
    expect(parsePackUnitsFromMetadata('not-json')).toHaveLength(0);
    expect(parsePackUnitsFromMetadata('{}')).toHaveLength(0);
  });

  it('filters entries missing required fields', () => {
    const partial = JSON.stringify([
      { usageUnit: 'ai_request', quantity: 100 },
      { usageUnit: 'bad', quantity: 'not-a-number' },
      { quantity: 50 },
    ]);
    const result = parsePackUnitsFromMetadata(partial);
    expect(result).toHaveLength(1);
    expect(result[0].usageUnit).toBe('ai_request');
  });
});

describe('buildCreditPackInsertRows', () => {
  it('produces one row per unit with correct fields', () => {
    const rows = buildCreditPackInsertRows({
      sessionId: 'cs_test_abc',
      paymentIntentId: 'pi_test_xyz',
      customerId: 'cus_test_def',
      metadata: BASE_METADATA,
      units: [{ usageUnit: 'ai_request', quantity: 100 }],
    });

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.stripe_checkout_session_id).toBe('cs_test_abc');
    expect(row.user_id).toBe('user-123');
    expect(row.employer_id).toBe('employer-456');
    expect(row.usage_unit).toBe('ai_request');
    expect(row.quantity_purchased).toBe(100);
    expect(row.quantity_remaining).toBe(100);
    expect(row.status).toBe('active');
    expect(row.expires_at).toBe('2026-07-01T00:00:00.000Z');
  });

  it('produces four rows for weather_map_500', () => {
    const weatherMeta = {
      ...BASE_METADATA,
      pack_id: 'weather_map_500',
    };
    const rows = buildCreditPackInsertRows({
      sessionId: 'cs_test_weather',
      paymentIntentId: null,
      customerId: null,
      metadata: weatherMeta,
      units: [
        { usageUnit: 'weather_request', quantity: 125 },
        { usageUnit: 'geocode_request', quantity: 125 },
        { usageUnit: 'travel_request', quantity: 125 },
        { usageUnit: 'place_search', quantity: 125 },
      ],
    });

    expect(rows).toHaveLength(4);
    const units = rows.map((r) => r.usage_unit);
    expect(units).toContain('weather_request');
    expect(units).toContain('geocode_request');
    expect(units).toContain('travel_request');
    expect(units).toContain('place_search');
    rows.forEach((row) => {
      expect(row.quantity_purchased).toBe(125);
      expect(row.quantity_remaining).toBe(125);
      expect(row.stripe_checkout_session_id).toBe('cs_test_weather');
    });
  });
});

describe('resolveCreditPackUnitsFromCheckoutMetadata', () => {
  it('uses serialised pack_units when valid', () => {
    const result = resolveCreditPackUnitsFromCheckoutMetadata({
      pack_id: 'ai_100',
      pack_units: JSON.stringify([{ usageUnit: 'ai_request', quantity: 100 }]),
    });
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(100);
  });

  it('falls back to catalog units when pack_units is missing', () => {
    const result = resolveCreditPackUnitsFromCheckoutMetadata({ pack_id: 'ai_100' });
    expect(result).toHaveLength(1);
    expect(result[0].usageUnit).toBe('ai_request');
    expect(result[0].quantity).toBe(100);
  });

  it('returns empty array for unknown pack_id', () => {
    const result = resolveCreditPackUnitsFromCheckoutMetadata({ pack_id: 'unknown_pack' });
    expect(result).toHaveLength(0);
  });
});
