import { describe, expect, it } from 'vitest';
import { UsageLimitError } from '../usageMetering';
import {
  buildUsageLimitPresentation,
  usageLimitToastMessage,
} from '../usageLimitUx';

describe('usageLimitUx', () => {
  const error = new UsageLimitError({
    error: 'usage_limit_reached',
    featureKey: 'weather.forecast',
    usageUnit: 'weather_request',
    limit: 25,
    used: 25,
    planId: 'free',
    upgradeRequired: true,
  });

  it('builds friendly presentation with quota and reset date', () => {
    const presentation = buildUsageLimitPresentation(error);
    expect(presentation.title).toMatch(/Weather forecasts/i);
    expect(presentation.quotaLabel).toBe('25 / 25');
    expect(presentation.resetLabel).toMatch(/Resets/);
    expect(presentation.upgradeUrl).toContain('/settings/billing?upgrade=starter');
  });

  it('formats toast copy for limit blocks', () => {
    const message = usageLimitToastMessage(error);
    expect(message).toMatch(/Weather Forecast limit/i);
    expect(message).toContain('25 / 25');
    expect(message).toMatch(/Resets/);
  });
});
