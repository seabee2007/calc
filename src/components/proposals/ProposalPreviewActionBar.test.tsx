import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProposalPreviewActionBar from './ProposalPreviewActionBar';

describe('ProposalPreviewActionBar', () => {
  it('renders Back to Editor, Send to Client, and Download PDF', () => {
    render(
      <ProposalPreviewActionBar
        saving={false}
        onBackToEditor={vi.fn()}
        onSend={vi.fn()}
        onDownload={vi.fn()}
      />,
    );

    expect(screen.getByTestId('proposal-preview-back-button')).toHaveTextContent(
      'Back to Editor',
    );
    expect(screen.getByTestId('proposal-preview-send-button')).toHaveTextContent(
      'Send to Client',
    );
    expect(screen.getByTestId('proposal-preview-download-button')).toHaveTextContent(
      'Download PDF',
    );
    expect(screen.queryByTestId('proposal-preview-edit-button')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Email' })).not.toBeInTheDocument();
  });

  it('shows optional Back to Proposals when opened from proposal list', () => {
    render(
      <ProposalPreviewActionBar
        saving={false}
        onBackToEditor={vi.fn()}
        onBackToProposals={vi.fn()}
        onSend={vi.fn()}
        onDownload={vi.fn()}
      />,
    );

    expect(screen.getByTestId('proposal-preview-back-to-proposals-button')).toHaveTextContent(
      'Back to Proposals',
    );
    expect(screen.queryByTestId('proposal-preview-edit-button')).not.toBeInTheDocument();
  });

  it('calls back-to-editor, send, and download handlers', async () => {
    const user = userEvent.setup();
    const onBackToEditor = vi.fn();
    const onSend = vi.fn();
    const onDownload = vi.fn();

    render(
      <ProposalPreviewActionBar
        saving={false}
        onBackToEditor={onBackToEditor}
        onSend={onSend}
        onDownload={onDownload}
      />,
    );

    await user.click(screen.getByTestId('proposal-preview-back-button'));
    await user.click(screen.getByTestId('proposal-preview-send-button'));
    await user.click(screen.getByTestId('proposal-preview-download-button'));

    expect(onBackToEditor).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});
