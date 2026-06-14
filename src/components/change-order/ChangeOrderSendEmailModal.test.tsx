import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChangeOrderSendEmailModal from './ChangeOrderSendEmailModal';

vi.mock('../../services/emailService', () => ({
  sendChangeOrderEmail: vi.fn(),
}));

vi.mock('../../store', () => ({
  useSettingsStore: (selector: (state: { companySettings: { companyName: string } }) => unknown) =>
    selector({ companySettings: { companyName: 'Concrete Co' } }),
}));

vi.mock('../../lib/changeOrderTracking', () => ({
  getPublicChangeOrderUrl: (token: string) => `https://app.example.com/change-order/${token}`,
}));

import { sendChangeOrderEmail } from '../../services/emailService';

describe('ChangeOrderSendEmailModal', () => {
  beforeEach(() => {
    vi.mocked(sendChangeOrderEmail).mockReset();
  });

  const baseProps = {
    changeOrderId: 'co-1',
    changeOrderToken: 'public-token-1',
    projectId: 'proj-1',
    projectName: 'Riverfront Slab',
    changeOrderTitle: 'Add patio',
    changeOrderNumber: 'CO-12',
    changeOrderTotal: 1250,
    clientName: 'Jane Client',
    clientEmail: 'client@example.com',
    onClose: vi.fn(),
    onSentSuccess: vi.fn(),
  };

  it('renders send modal fields without showing raw public URL', () => {
    render(<ChangeOrderSendEmailModal {...baseProps} />);

    expect(screen.getByText('Send Change Order to Client')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('client@example.com')).toHaveValue('client@example.com');
    expect(screen.getByDisplayValue('Change Order for Riverfront Slab')).toBeInTheDocument();
    expect(screen.getByText('Email message')).toBeInTheDocument();
    expect(screen.getByText('Secure review link ready')).toBeInTheDocument();
    expect(
      screen.queryByText('https://app.example.com/change-order/public-token-1'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send change order email' })).toBeInTheDocument();
  });

  it('does not use mailto links', () => {
    render(<ChangeOrderSendEmailModal {...baseProps} />);
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('highlights missing client email when requested', () => {
    render(
      <ChangeOrderSendEmailModal
        {...baseProps}
        clientEmail=""
        highlightEmail
      />,
    );

    expect(screen.getByText('Add a client email before sending.')).toBeInTheDocument();
  });

  it('shows interpolated preview when expanded', async () => {
    const user = userEvent.setup();
    render(<ChangeOrderSendEmailModal {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Email preview' }));

    expect(screen.getByLabelText('Email message preview')).toHaveTextContent('Jane Client');
    expect(screen.getByLabelText('Email message preview')).toHaveTextContent(
      'https://app.example.com/change-order/public-token-1',
    );
  });

  it('calls sendChangeOrderEmail and onSentSuccess when send succeeds', async () => {
    const user = userEvent.setup();
    const onSentSuccess = vi.fn();
    vi.mocked(sendChangeOrderEmail).mockResolvedValue({ ok: true });

    render(<ChangeOrderSendEmailModal {...baseProps} onSentSuccess={onSentSuccess} />);

    await user.click(screen.getByRole('button', { name: 'Send change order email' }));

    expect(sendChangeOrderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        changeOrderId: 'co-1',
        changeOrderToken: 'public-token-1',
        recipientEmail: 'client@example.com',
        emailSubject: 'Change Order for Riverfront Slab',
        projectName: 'Riverfront Slab',
        changeOrderTitle: 'Add patio',
        changeOrderNumber: 'CO-12',
        changeOrderTotal: '$1,250.00',
        clientName: 'Jane Client',
        messageBody: expect.stringContaining('Jane Client'),
      }),
    );
    expect(onSentSuccess).toHaveBeenCalledWith(
      'client@example.com',
      'https://app.example.com/change-order/public-token-1',
    );
  });

  it('keeps copy link available when email send fails', async () => {
    const user = userEvent.setup();
    vi.mocked(sendChangeOrderEmail).mockRejectedValue(new Error('SMTP down'));

    render(<ChangeOrderSendEmailModal {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Send change order email' }));

    expect(
      screen.getByText(
        'Could not send the change order email. You can still copy the review link and send it manually.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy change order link' })).toBeInTheDocument();
  });

  it('blocks send when review URL is missing', async () => {
    const user = userEvent.setup();
    render(<ChangeOrderSendEmailModal {...baseProps} changeOrderToken="" />);

    await user.click(screen.getByRole('button', { name: 'Send change order email' }));

    expect(sendChangeOrderEmail).not.toHaveBeenCalled();
    expect(
      screen.getByText('Change order review link is not ready. Save the change order and try again.'),
    ).toBeInTheDocument();
  });
});
