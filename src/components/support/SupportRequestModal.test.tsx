import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SupportRequestModal from './SupportRequestModal';

const mockSendSupportRequest = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'owner@example.com' },
  }),
}));

vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    plan: 'professional',
  }),
}));

vi.mock('../../services/supportRequestService', () => ({
  sendSupportRequest: (...args: unknown[]) => mockSendSupportRequest(...args),
}));

describe('SupportRequestModal', () => {
  beforeEach(() => {
    mockSendSupportRequest.mockReset();
    mockSendSupportRequest.mockResolvedValue({ ok: true, supportRequestId: 'req-1' });
  });

  it('renders topic dropdown with all options', () => {
    render(<SupportRequestModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Support topic')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Billing or subscription' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bug report' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Other / Not listed' })).toBeInTheDocument();
  });

  it('auto-populates billing subject and body', () => {
    render(<SupportRequestModal isOpen onClose={vi.fn()} />);

    expect(screen.getByLabelText('Subject')).toHaveValue('Billing or subscription support');
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toContain(
      'billing or my subscription',
    );
  });

  it('auto-populates bug report template when topic changes', async () => {
    const user = userEvent.setup();
    render(<SupportRequestModal isOpen onClose={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Support topic'), 'bug_report');

    expect(screen.getByLabelText('Subject')).toHaveValue('Bug report');
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toContain('I found a bug.');
  });

  it('auto-populates feature request template when topic changes', async () => {
    const user = userEvent.setup();
    render(<SupportRequestModal isOpen onClose={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Support topic'), 'feature_request');

    expect(screen.getByLabelText('Subject')).toHaveValue('Feature request');
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toContain(
      'I have a feature request.',
    );
  });

  it('clears subject for Other / Not listed and preserves edited body on topic change', async () => {
    const user = userEvent.setup();
    render(<SupportRequestModal isOpen onClose={vi.fn()} />);

    const messageField = screen.getByLabelText('Message');
    await user.clear(messageField);
    await user.type(messageField, 'Custom support message that should stay when topic changes.');

    await user.selectOptions(screen.getByLabelText('Support topic'), 'other');
    expect(screen.getByLabelText('Subject')).toHaveValue('');
    expect(screen.getByLabelText('Subject')).toHaveAttribute('placeholder', 'Enter your subject');

    await user.selectOptions(screen.getByLabelText('Support topic'), 'billing');
    expect(messageField).toHaveValue('Custom support message that should stay when topic changes.');
  });

  it('submits support request with correct payload', async () => {
    const user = userEvent.setup();
    render(<SupportRequestModal isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => {
      expect(mockSendSupportRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'billing',
          subject: 'Billing or subscription support',
          contactEmail: 'owner@example.com',
        }),
      );
    });
  });

  it('shows success message after submit', async () => {
    const user = userEvent.setup();
    render(<SupportRequestModal isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Send request' }));

    expect(await screen.findByText(/Support request sent\. We'll get back to you at owner@example.com\./)).toBeInTheDocument();
  });

  it('shows validation error when Other / Not listed has empty subject', async () => {
    const user = userEvent.setup();
    render(<SupportRequestModal isOpen onClose={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Support topic'), 'other');
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your subject.');
    expect(mockSendSupportRequest).not.toHaveBeenCalled();
  });
});
