import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProposalPipelineBoard from './ProposalPipelineBoard';
import type { SavedProposal } from '../../lib/proposalService';

function makeProposal(
  id: string,
  status: SavedProposal['status'],
  total = 1000,
): SavedProposal {
  return {
    id,
    user_id: 'user-1',
    project_id: null,
    title: `Proposal ${id}`,
    template_type: 'minimal',
    data: {} as SavedProposal['data'],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    status,
    sent_at: null,
    viewed_at: null,
    opened_at: null,
    accepted_at: null,
    declined_at: null,
    deposit_paid_at: null,
    scheduled_at: null,
    paid_at: null,
    total_amount: total,
    labor_cost: 0,
    material_cost: 0,
    deposit_amount: 0,
    gross_profit: 0,
    gross_margin_percent: 0,
    public_token: `token-${id}`,
  };
}

describe('ProposalPipelineBoard', () => {
  it('renders status summary cards with counts', () => {
    const proposals = [
      makeProposal('1', 'draft'),
      makeProposal('2', 'sent'),
      makeProposal('3', 'declined'),
    ];

    render(
      <ProposalPipelineBoard
        proposals={proposals}
        selected="all"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole('group', { name: 'Proposal pipeline stage' })).toBeInTheDocument();
    expect(screen.getByTestId('proposal-pipeline-stage-all')).toHaveTextContent('All');
    expect(screen.getByTestId('proposal-pipeline-stage-all')).toHaveTextContent('3');
    expect(screen.getByTestId('proposal-pipeline-stage-draft')).toHaveTextContent('1');
    expect(screen.getByTestId('proposal-pipeline-stage-sent')).toHaveTextContent('1');
    expect(screen.getByTestId('proposal-pipeline-stage-declined')).toHaveTextContent('1');
  });

  it('marks the selected status card as pressed', () => {
    render(
      <ProposalPipelineBoard
        proposals={[makeProposal('1', 'draft')]}
        selected="draft"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId('proposal-pipeline-stage-draft')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('proposal-pipeline-stage-all')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('calls onSelect when a status card is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <ProposalPipelineBoard
        proposals={[makeProposal('1', 'draft')]}
        selected="all"
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByTestId('proposal-pipeline-stage-sent'));
    expect(onSelect).toHaveBeenCalledWith('sent');
  });
});
