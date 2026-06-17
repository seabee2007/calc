import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UsageLimitNotice } from '../../components/subscription/UsageLimitNotice';
import { UsageLimitError } from '../usageMetering';

describe('UsageLimitNotice', () => {
  it('renders friendly limit reached UI with upgrade link', () => {
    const error = new UsageLimitError({
      error: 'usage_limit_reached',
      featureKey: 'mapbox.geocode',
      usageUnit: 'geocode_request',
      limit: 10,
      used: 10,
      planId: 'free',
      upgradeRequired: true,
    });

    render(
      <MemoryRouter>
        <UsageLimitNotice error={error} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('usage-limit-notice')).toBeInTheDocument();
    expect(screen.getByText(/Address lookups limit reached/i)).toBeInTheDocument();
    expect(screen.getByText(/10 \/ 10/)).toBeInTheDocument();
    expect(screen.getByTestId('usage-limit-upgrade-link')).toHaveAttribute(
      'href',
      '/settings/billing?upgrade=starter',
    );
  });
});
