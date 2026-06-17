import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UsageLimitsPanel from '../UsageLimitsPanel';
import type { UsageSummary } from '../../../services/usageSummaryService';

const createUsageCreditCheckoutMock = vi.fn();

vi.mock('../../../services/billingService', () => ({
  createUsageCreditCheckout: (...args: unknown[]) => createUsageCreditCheckoutMock(...args),
  redirectToStripeUrl: vi.fn(),
}));

function makeItem(
  usageUnit: string,
  used: number,
  limit: number,
  creditRemaining = 0,
) {
  return {
    usageUnit,
    label: usageUnit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    creditRemaining,
    creditsExpireAt: creditRemaining > 0 ? '2026-07-01T00:00:00.000Z' : null,
    percentUsed: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100,
    resetsAt: '2026-07-01T00:00:00.000Z',
  };
}

function makeSummary(planId: string, creditRemaining = 0): UsageSummary {
  return {
    periodStart: '2026-06-01T00:00:00.000Z',
    periodEnd: '2026-07-01T00:00:00.000Z',
    planId: planId as UsageSummary['planId'],
    items: [
      makeItem('ai_request', 50, 50, creditRemaining),
      makeItem('weather_request', 10, 250),
      makeItem('geocode_request', 5, 100),
      makeItem('travel_request', 3, 100),
      makeItem('place_search', 2, 100),
      makeItem('email_send', 0, 100),
    ],
  };
}

function renderPanel(props: Partial<React.ComponentProps<typeof UsageLimitsPanel>> = {}) {
  return render(
    <MemoryRouter>
      <UsageLimitsPanel {...props} />
    </MemoryRouter>,
  );
}

describe('UsageLimitsPanel — paid owner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders usage rows when summary is loaded', () => {
    renderPanel({ summary: makeSummary('starter') });
    const rows = screen.getAllByTestId('usage-limit-row');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('shows "Buy more" button for paid owner when summary is loaded', () => {
    renderPanel({ summary: makeSummary('starter') });
    const buttons = screen.getAllByTestId('usage-buy-more-button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('calls createUsageCreditCheckout when Buy more is clicked', async () => {
    createUsageCreditCheckoutMock.mockResolvedValue('https://checkout.stripe.com/test');
    renderPanel({ summary: makeSummary('starter') });
    const btn = screen.getAllByTestId('usage-buy-more-button')[0];
    fireEvent.click(btn);
    await waitFor(() => {
      expect(createUsageCreditCheckoutMock).toHaveBeenCalledTimes(1);
    });
  });

  it('shows credit remaining when credits exist', () => {
    renderPanel({ summary: makeSummary('starter', 80) });
    const creditTexts = screen.getAllByText(/80.*credits/i);
    expect(creditTexts.length).toBeGreaterThan(0);
  });

  it('shows upgrade CTA for starter plan', () => {
    renderPanel({ summary: makeSummary('starter') });
    expect(screen.getByTestId('usage-upgrade-cta')).toBeTruthy();
  });
});

describe('UsageLimitsPanel — free plan', () => {
  it('does NOT show Buy more button when plan is free', () => {
    renderPanel({ summary: makeSummary('free') });
    expect(screen.queryAllByTestId('usage-buy-more-button')).toHaveLength(0);
  });

  it('shows upgrade CTA for free plan', () => {
    renderPanel({ summary: makeSummary('free') });
    expect(screen.getByTestId('usage-upgrade-cta')).toBeTruthy();
  });
});

describe('UsageLimitsPanel — owner-only blocked', () => {
  it('shows blocked message when ownerOnlyBlocked=true', () => {
    renderPanel({ summary: null, ownerOnlyBlocked: true });
    expect(screen.getByText(/account owners/i)).toBeTruthy();
    expect(screen.queryByTestId('usage-buy-more-button')).toBeNull();
  });
});

describe('UsageLimitsPanel — loading/error states', () => {
  it('shows loading state', () => {
    renderPanel({ summary: null, loading: true });
    expect(screen.getByText(/loading usage/i)).toBeTruthy();
  });

  it('shows error message', () => {
    renderPanel({ summary: null, error: 'Failed to load usage' });
    expect(screen.getByTestId('usage-limits-error')).toBeTruthy();
  });
});
