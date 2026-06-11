import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PageHeader from './PageHeader';

describe('PageHeader', () => {
  it('renders title and subtitle', () => {
    render(<PageHeader title="Operations" subtitle="Daily command center" />);
    expect(screen.getByRole('heading', { name: 'Operations' })).toBeInTheDocument();
    expect(screen.getByText('Daily command center')).toBeInTheDocument();
  });

  it('renders action slot', () => {
    render(
      <PageHeader
        title="Proposals"
        actions={<button type="button">New Proposal</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'New Proposal' })).toBeInTheDocument();
  });

  it('uses interior title styling without drop-shadow class by default', () => {
    render(<PageHeader title="Dashboard" />);
    const heading = screen.getByRole('heading', { name: 'Dashboard' });
    expect(heading.className).not.toMatch(/drop-shadow/);
  });
});
