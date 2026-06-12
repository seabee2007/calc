import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProposalNextActionsPanel from './ProposalNextActionsPanel';
import type { ProposalNextAction } from '../../types/proposalNextAction';

const followUpAction: ProposalNextAction = {
  id: 'prop-1-follow_up_proposal',
  type: 'follow_up_proposal',
  proposalId: 'prop-1',
  projectId: 'proj-1',
  clientName: 'Drew Billy Bob',
  proposalTitle: 'CO26-201 Single Story Concrete House With Garage',
  projectName: 'CO26-201 Single Story Concrete House With Garage',
  status: 'sent',
  label: 'Follow up',
  description: 'Sent 5 days ago',
  priority: 'high',
};

describe('ProposalNextActionsPanel', () => {
  it('calls onAction instead of scrolling the pipeline', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(<ProposalNextActionsPanel items={[followUpAction]} onAction={onAction} />);

    await user.click(screen.getByRole('button', { name: /Follow up/i }));

    expect(onAction).toHaveBeenCalledWith(followUpAction);
  });

  it('shows action-specific send label for email actions', () => {
    render(<ProposalNextActionsPanel items={[followUpAction]} onAction={vi.fn()} />);

    expect(screen.getByText('Send follow-up')).toBeInTheDocument();
  });
});
