import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProposalPreviewActionBar from './ProposalPreviewActionBar';

describe('ProposalPreviewActionBar', () => {
  it('renders Send to Client and Download PDF', () => {
    render(
      <ProposalPreviewActionBar
        isPreviewMode={false}
        saving={false}
        onBack={vi.fn()}
        onSend={vi.fn()}
        onDownload={vi.fn()}
      />,
    );

    expect(screen.getByTestId('proposal-preview-send-button')).toHaveTextContent(
      'Send to Client',
    );
    expect(screen.getByTestId('proposal-preview-download-button')).toHaveTextContent(
      'Download PDF',
    );
    expect(screen.queryByRole('button', { name: 'Email' })).not.toBeInTheDocument();
  });

  it('does not render Email button', () => {
    render(
      <ProposalPreviewActionBar
        isPreviewMode
        saving={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onSend={vi.fn()}
        onDownload={vi.fn()}
      />,
    );

    expect(screen.queryByText(/^Email$/)).not.toBeInTheDocument();
  });

  it('shows Back to Editor when not in preview-only mode', () => {
    render(
      <ProposalPreviewActionBar
        isPreviewMode={false}
        saving={false}
        onBack={vi.fn()}
        onSend={vi.fn()}
        onDownload={vi.fn()}
      />,
    );

    expect(screen.getByTestId('proposal-preview-back-button')).toHaveTextContent(
      'Back to Editor',
    );
    expect(screen.queryByTestId('proposal-preview-edit-button')).not.toBeInTheDocument();
  });

  it('shows Back and Edit when opened from proposal list preview', () => {
    render(
      <ProposalPreviewActionBar
        isPreviewMode
        saving={false}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onSend={vi.fn()}
        onDownload={vi.fn()}
      />,
    );

    expect(screen.getByTestId('proposal-preview-back-button')).toHaveTextContent('Back');
    expect(screen.getByTestId('proposal-preview-edit-button')).toBeInTheDocument();
  });

  it('calls send and download handlers without duplicate edit/back actions', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onDownload = vi.fn();

    render(
      <ProposalPreviewActionBar
        isPreviewMode={false}
        saving={false}
        onBack={vi.fn()}
        onSend={onSend}
        onDownload={onDownload}
      />,
    );

    await user.click(screen.getByTestId('proposal-preview-send-button'));
    await user.click(screen.getByTestId('proposal-preview-download-button'));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});
