import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardHero from './DashboardHero';

vi.mock('../ui/Button', () => ({
  default: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

describe('DashboardHero', () => {
  const defaultProps = {
    activeProjects: 3,
    proposalsSent: 2,
    onStartProject: vi.fn(),
    onQuickQuote: vi.fn(),
  };

  it('shows Placements Today when placementsToday is provided', () => {
    render(<DashboardHero {...defaultProps} placementsToday={1} />);
    expect(screen.getByText('Placements Today')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('omits Placements Today stat when placementsToday is undefined', () => {
    render(<DashboardHero {...defaultProps} />);
    expect(screen.queryByText('Placements Today')).not.toBeInTheDocument();
    expect(screen.getByText('Active Projects')).toBeInTheDocument();
    expect(screen.getByText('Proposals Sent')).toBeInTheDocument();
  });

  it('shows full action labels when compactActions is false', () => {
    render(<DashboardHero {...defaultProps} compactActions={false} />);
    expect(screen.getByRole('button', { name: /Start Project/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Quick Quote/i })).toBeInTheDocument();
  });

  it('shows short action labels when compactActions is true', () => {
    render(<DashboardHero {...defaultProps} compactActions />);
    expect(screen.getByRole('button', { name: /^Start$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Quote$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start Project/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quick Quote/i })).not.toBeInTheDocument();
  });
});
