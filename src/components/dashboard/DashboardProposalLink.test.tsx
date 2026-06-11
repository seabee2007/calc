import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardProposalLink from './DashboardProposalLink';

describe('DashboardProposalLink', () => {
  it('renders pipeline value and link', () => {
    render(
      <MemoryRouter>
        <DashboardProposalLink pipelineValue={125000} proposalCount={3} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Proposal pipeline')).toBeInTheDocument();
    expect(screen.getByText('$125,000')).toBeInTheDocument();
    expect(screen.getByText(/3 active proposals/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View pipeline/i })).toBeInTheDocument();
  });
});
