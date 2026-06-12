import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProposalSendEmailModal from './ProposalSendEmailModal';

describe('ProposalSendEmailModal', () => {
  it('defaults To from project client email when modal opens', () => {
    render(
      <ProposalSendEmailModal
        isOpen
        onClose={() => {}}
        proposalTitle="Riverfront Slab"
        defaultRecipientEmail="client1@example.com"
        onSend={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('client@example.com')).toHaveValue('client1@example.com');
    expect(
      screen.getByText('Defaulted from the project client email. You can change it before sending.'),
    ).toBeInTheDocument();
  });

  it('allows editing To and CC before sending', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(
      <ProposalSendEmailModal
        isOpen
        onClose={() => {}}
        proposalTitle="Riverfront Slab"
        defaultRecipientEmail="client1@example.com"
        onSend={onSend}
      />,
    );

    const [toInput, ccInput] = screen.getAllByRole('textbox');
    await user.clear(toInput);
    await user.type(toInput, 'client2@example.com');
    await user.type(ccInput, 'owner@example.com');
    await user.click(screen.getByRole('button', { name: 'Send email' }));

    expect(onSend).toHaveBeenCalledWith({
      to: 'client2@example.com',
      cc: ['owner@example.com'],
      messageNote: undefined,
    });
  });

  it('blocks send when CC email is invalid', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(
      <ProposalSendEmailModal
        isOpen
        onClose={() => {}}
        proposalTitle="Riverfront Slab"
        defaultRecipientEmail="client1@example.com"
        onSend={onSend}
      />,
    );

    await user.type(
      screen.getByPlaceholderText('owner@example.com, billing@example.com'),
      'not-an-email',
    );
    await user.click(screen.getByRole('button', { name: 'Send email' }));

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText(/Invalid: not-an-email/i)).toBeInTheDocument();
  });

  it('uses follow-up title and submit label in follow-up mode', () => {
    render(
      <ProposalSendEmailModal
        isOpen
        onClose={() => {}}
        proposalTitle="Riverfront Slab"
        mode="followUp"
        defaultRecipientEmail="client1@example.com"
        onSend={vi.fn()}
      />,
    );

    expect(screen.getByText('Follow up on proposal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Follow up: Riverfront Slab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send follow-up' })).toBeInTheDocument();
  });

  it('uses deposit request labels in deposit mode', () => {
    render(
      <ProposalSendEmailModal
        isOpen
        onClose={() => {}}
        proposalTitle="Riverfront Slab"
        mode="deposit"
        defaultRecipientEmail="client1@example.com"
        onSend={vi.fn()}
      />,
    );

    expect(screen.getByText('Request deposit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send deposit request' })).toBeInTheDocument();
  });
});
