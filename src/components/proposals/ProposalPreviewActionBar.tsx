import React from 'react';
import { ArrowLeft, Download, Send } from 'lucide-react';
import Button from '../ui/Button';

export interface ProposalPreviewActionBarProps {
  saving: boolean;
  onBackToEditor: () => void;
  onBackToProposals?: () => void;
  onSend: () => void;
  onDownload: () => void;
}

const ProposalPreviewActionBar: React.FC<ProposalPreviewActionBarProps> = ({
  saving,
  onBackToEditor,
  onBackToProposals,
  onSend,
  onDownload,
}) => {
  return (
    <div
      className="mt-4 flex flex-wrap gap-3"
      data-testid="proposal-preview-action-bar"
    >
      <Button
        variant="outline"
        size="sm"
        onClick={onBackToEditor}
        icon={<ArrowLeft size={18} />}
        data-testid="proposal-preview-back-button"
      >
        Back to Editor
      </Button>

      {onBackToProposals ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onBackToProposals}
          data-testid="proposal-preview-back-to-proposals-button"
        >
          Back to Proposals
        </Button>
      ) : null}

      <Button
        variant="primary"
        size="sm"
        onClick={onSend}
        disabled={saving}
        isLoading={saving}
        icon={<Send size={18} />}
        data-testid="proposal-preview-send-button"
      >
        Send to Client
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onDownload}
        icon={<Download size={18} />}
        data-testid="proposal-preview-download-button"
      >
        Download PDF
      </Button>
    </div>
  );
};

export default ProposalPreviewActionBar;
