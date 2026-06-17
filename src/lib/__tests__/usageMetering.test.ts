import { describe, expect, it } from 'vitest';
import {
  UsageLimitError,
  buildBillingUpgradeUrl,
  parseEdgeFunctionJson,
  parseUsageLimitPayload,
} from '../usageMetering';

describe('usageMetering', () => {
  it('parses usage_limit_reached payloads', () => {
    const payload = parseUsageLimitPayload({
      error: 'usage_limit_reached',
      featureKey: 'mapbox.geocode',
      usageUnit: 'geocode_request',
      limit: 10,
      used: 10,
      planId: 'free',
      upgradeRequired: true,
    });
    expect(payload?.usageUnit).toBe('geocode_request');
  });

  it('throws UsageLimitError for 429 responses', async () => {
    const res = new Response(
      JSON.stringify({
        error: 'usage_limit_reached',
        featureKey: 'ai.ask_concrete',
        usageUnit: 'ai_request',
        limit: 0,
        used: 0,
        planId: 'free',
        upgradeRequired: true,
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );

    await expect(parseEdgeFunctionJson(res)).rejects.toBeInstanceOf(UsageLimitError);
  });

  it('throws generic Error for other failures', async () => {
    const res = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    await expect(parseEdgeFunctionJson(res)).rejects.toThrow('Unauthorized');
  });

  it('builds billing upgrade URLs', () => {
    expect(buildBillingUpgradeUrl('professional')).toBe('/settings/billing?upgrade=professional');
    expect(buildBillingUpgradeUrl('starter', '/projects')).toContain('returnTo=%2Fprojects');
  });
});
