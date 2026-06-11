import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProposalPipelineCard from './ProposalPipelineCard';
import { PROPOSAL_PIPELINE_STATUSES } from '../../types/proposalTracking';

const emptyPipeline = Object.fromEntries(
  PROPOSAL_PIPELINE_STATUSES.map((status) => [status, 0]),
) as Record<(typeof PROPOSAL_PIPELINE_STATUSES)[number], number>;

describe('ProposalPipelineCard', () => {
  it('renders summary pipeline metrics without full status grid', () => {
    render(
      <MemoryRouter>
        <ProposalPipelineCard
          pipeline={{ ...emptyPipeline, draft: 2, sent: 3, accepted: 1 }}
          pipelineValue={250000}
          weightedForecast={180000}
          proposals={[]}
          winRate={0.5}
          wonThisMonth={50000}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Proposal pipeline')).toBeInTheDocument();
    expect(screen.getByText('Pipeline value')).toBeInTheDocument();
    expect(screen.getByText('Weighted forecast')).toBeInTheDocument();
    expect(screen.getByText('Manage proposals →')).toBeInTheDocument();
    expect(screen.getByText('Needs follow-up')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('In review')).toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.queryByText('Declined')).not.toBeInTheDocument();
    expect(screen.queryByText('Deposit paid')).not.toBeInTheDocument();
  });
});
