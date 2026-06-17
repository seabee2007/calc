import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UsageLimitsPanel from '../UsageLimitsPanel';
import type { UsageSummary } from '../../../services/usageSummaryService';

const baseSummary: UsageSummary = {
  periodStart: '2026-06-01T00:00:00.000Z',
  periodEnd: '2026-07-01T00:00:00.000Z',
  planId: 'free',
  items: [
    {
      usageUnit: 'ai_request',
      label: 'AI requests',
      used: 0,
      limit: 0,
      remaining: 0,
      percentUsed: 100,
      resetsAt: '2026-07-01T00:00:00.000Z',
    },
    {
      usageUnit: 'weather_request',
      label: 'Weather forecasts',
      used: 23,
      limit: 25,
      remaining: 2,
      percentUsed: 92,
      resetsAt: '2026-07-01T00:00:00.000Z',
    },
    {
      usageUnit: 'geocode_request',
      label: 'Address lookups',
      used: 10,
      limit: 10,
      remaining: 0,
      percentUsed: 100,
      resetsAt: '2026-07-01T00:00:00.000Z',
    },
    {
      usageUnit: 'travel_request',
      label: 'Travel-time checks',
      used: 2,
      limit: 10,
      remaining: 8,
      percentUsed: 20,
      resetsAt: '2026-07-01T00:00:00.000Z',
    },
    {
      usageUnit: 'place_search',
      label: 'Place searches',
      used: 1,
      limit: 10,
      remaining: 9,
      percentUsed: 10,
      resetsAt: '2026-07-01T00:00:00.000Z',
    },
    {
      usageUnit: 'email_send',
      label: 'Email sends',
      used: 3,
      limit: 10,
      remaining: 7,
      percentUsed: 30,
      resetsAt: '2026-07-01T00:00:00.000Z',
    },
  ],
};

function renderPanel(props: Partial<ComponentProps<typeof UsageLimitsPanel>> = {}) {
  return render(
    <MemoryRouter>
      <UsageLimitsPanel summary={baseSummary} {...props} />
    </MemoryRouter>,
  );
}

describe('UsageLimitsPanel', () => {
  it('renders grouped usage rows on billing view', () => {
    renderPanel();
    expect(screen.getByTestId('usage-limits-panel')).toBeInTheDocument();
    expect(screen.getByText('AI requests')).toBeInTheDocument();
    expect(screen.getByText('Weather requests')).toBeInTheDocument();
    expect(screen.getByText('Map / geocode requests')).toBeInTheDocument();
    expect(screen.getByText('Email sends')).toBeInTheDocument();
  });

  it('shows free AI disabled state', () => {
    renderPanel();
    expect(screen.getByText('Not included on your plan')).toBeInTheDocument();
  });

  it('shows warning style at 80% usage', () => {
    renderPanel();
    const warningBar = screen
      .getAllByTestId('usage-limit-progress')
      .find((node) => node.getAttribute('data-usage-band') === 'warning');
    expect(warningBar).toBeTruthy();
  });

  it('shows blocked style and upgrade CTA at 100%', () => {
    renderPanel();
    const blockedBars = screen
      .getAllByTestId('usage-limit-progress')
      .filter((node) => node.getAttribute('data-usage-band') === 'blocked');
    expect(blockedBars.length).toBeGreaterThan(0);
    expect(screen.getByTestId('usage-upgrade-cta')).toBeInTheDocument();
  });

  it('shows owner-only notice for employees', () => {
    renderPanel({ summary: null, ownerOnlyBlocked: true });
    expect(screen.getByText(/account owners/i)).toBeInTheDocument();
  });
});
