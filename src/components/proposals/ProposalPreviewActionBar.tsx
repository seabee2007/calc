import React from 'react';
import { ArrowLeft, Download, Edit, Send } from 'lucide-react';
import Button from '../ui/Button';

export interface ProposalPreviewActionBarProps {
  isPreviewMode: boolean;
  saving: boolean;
  onBack: () => void;
  onEdit?: () => void;
  onSend: () => void;
  onDownload: () => void;
}

const ProposalPreviewActionBar: React.FC<ProposalPreviewActionBarProps> = ({
  isPreviewMode,
  saving,
  onBack,
  onEdit,
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
        onClick={onBack}
        icon={<ArrowLeft size={18} />}
        data-testid="proposal-preview-back-button"
      >
        {isPreviewMode ? 'Back' : 'Back to Editor'}
      </Button>

      {isPreviewMode && onEdit && (
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          icon={<Edit size={18} />}
          data-testid="proposal-preview-edit-button"
        >
          Edit
        </Button>
      )}

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
