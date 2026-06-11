import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import KpiStrip from './KpiStrip';

describe('KpiStrip', () => {
  it('renders metric labels and values', () => {
    render(
      <KpiStrip
        metrics={[
          { label: 'Active projects', value: 3 },
          { label: 'Placements today', value: 1, highlight: true },
        ]}
      />,
    );
    expect(screen.getByText('Active projects')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Placements today')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading', () => {
    const { container } = render(<KpiStrip metrics={[]} loading />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });
});
