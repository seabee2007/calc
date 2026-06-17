import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UsageLimitNotice } from '../UsageLimitNotice';
import { UsageLimitError } from '../../../lib/usageMetering';
import type { UsageFeatureKey, UsageUnit } from '../../../lib/usageLimits';
import type { PlanId } from '../../../lib/entitlements';

function makeError(overrides: {
  planId?: PlanId;
  usageUnit?: UsageUnit;
  featureKey?: UsageFeatureKey;
  used?: number;
  limit?: number;
  buyMoreAvailable?: boolean;
} = {}): UsageLimitError {
  return new UsageLimitError({
    error: 'usage_limit_reached',
    featureKey: overrides.featureKey ?? 'ai.ask_concrete',
    usageUnit: overrides.usageUnit ?? 'ai_request',
    limit: overrides.limit ?? 50,
    used: overrides.used ?? 50,
    planId: overrides.planId ?? 'starter',
    upgradeRequired: true,
    buyMoreAvailable: overrides.buyMoreAvailable ?? true,
  });
}

function renderNotice(props: Partial<React.ComponentProps<typeof UsageLimitNotice>> = {}) {
  const error = props.error ?? makeError();
  return render(
    <MemoryRouter>
      <UsageLimitNotice error={error} {...props} />
    </MemoryRouter>,
  );
}

describe('UsageLimitNotice — paid owner hitting limit', () => {
  it('renders the notice container', () => {
    renderNotice();
    expect(screen.getByTestId('usage-limit-notice')).toBeTruthy();
  });

  it('shows primary "Buy more credits" link when buyMoreAvailable and paid plan', () => {
    renderNotice({ error: makeError({ planId: 'starter', buyMoreAvailable: true }) });
    expect(screen.getByTestId('usage-limit-buy-credits-link')).toBeTruthy();
  });

  it('shows secondary upgrade link when buy is primary action', () => {
    renderNotice({ error: makeError({ planId: 'starter', buyMoreAvailable: true }) });
    expect(screen.getByTestId('usage-limit-upgrade-link')).toBeTruthy();
  });
});

describe('UsageLimitNotice — free plan', () => {
  it('shows upgrade as primary action for free plan', () => {
    renderNotice({
      error: makeError({ planId: 'free', buyMoreAvailable: false }),
    });
    const upgradeLink = screen.getByTestId('usage-limit-upgrade-link');
    expect(upgradeLink.className).toContain('cyan');
  });

  it('does NOT show buy-credits link for free plan (no buyMoreAvailable)', () => {
    renderNotice({ error: makeError({ planId: 'free', buyMoreAvailable: false }) });
    expect(screen.queryByTestId('usage-limit-buy-credits-link')).toBeNull();
  });
});

describe('UsageLimitNotice — unit-specific messaging', () => {
  it('shows ai_request title', () => {
    renderNotice({ error: makeError({ usageUnit: 'ai_request' }) });
    expect(screen.getByTestId('usage-limit-notice').textContent).toMatch(/ai request/i);
  });

  it('shows weather title', () => {
    renderNotice({
      error: makeError({
        usageUnit: 'weather_request',
        featureKey: 'weather.forecast',
        buyMoreAvailable: true,
        planId: 'starter',
      }),
    });
    expect(screen.getByTestId('usage-limit-notice').textContent).toMatch(/weather/i);
  });
});

describe('UsageLimitNotice — quota / reset labels', () => {
  it('shows quota and reset information', () => {
    renderNotice();
    const notice = screen.getByTestId('usage-limit-notice');
    expect(notice.textContent).toMatch(/50/);
    expect(notice.textContent).toMatch(/Resets/i);
  });
});
