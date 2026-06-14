import React, { useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { OPS_BODY, OPS_MUTED, OPS_OUTLINE_BTN, OPS_TITLE } from '../dashboard/opsTheme';

interface ChangeOrderSentModalProps {
  clientEmail: string;
  changeOrderUrl: string;
  onClose: () => void;
}

const ChangeOrderSentModal: React.FC<ChangeOrderSentModalProps> = ({
  clientEmail,
  changeOrderUrl,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(changeOrderUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen title="Change Order Sent" onClose={onClose} size="md">
      <div className="space-y-4 -mt-2">
        <p className={`text-sm ${OPS_BODY}`}>
          The change order was sent to{' '}
          <span className={`font-medium ${OPS_TITLE}`}>{clientEmail}</span>.
        </p>
        <p className={`text-sm ${OPS_MUTED}`}>
          You can copy the secure review link if you need to share it manually.
        </p>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-700 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className={OPS_OUTLINE_BTN} onClick={onClose}>
            Done
          </Button>
          <Button
            type="button"
            variant="outline"
            className={OPS_OUTLINE_BTN}
            icon={<Copy size={16} />}
            onClick={() => void handleCopy()}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
          <Button
            type="button"
            variant="accent"
            icon={<ExternalLink size={16} />}
            onClick={() => window.open(changeOrderUrl, '_blank', 'noopener,noreferrer')}
          >
            Open Change Order
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ChangeOrderSentModal;
