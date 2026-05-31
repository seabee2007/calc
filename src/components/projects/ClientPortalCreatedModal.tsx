import React, { useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { getClientPortalUrl } from '../../services/clientPortalService';
import {
  OPS_BODY,
  OPS_HERO_STAT_INNER,
  OPS_MUTED,
  OPS_OUTLINE_BTN,
  OPS_TITLE,
} from '../dashboard/opsTheme';

interface ClientPortalCreatedModalProps {
  clientName: string;
  token: string;
  onClose: () => void;
}

const ClientPortalCreatedModal: React.FC<ClientPortalCreatedModalProps> = ({
  clientName,
  token,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const url = getClientPortalUrl(token);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen title="Client Portal Created" onClose={onClose} size="md">
      <div className="space-y-4 -mt-2">
        <div>
          <p className={`text-sm ${OPS_MUTED}`}>Client</p>
          <p className={`font-medium ${OPS_TITLE}`}>{clientName}</p>
        </div>

        <div>
          <p className={`text-sm ${OPS_MUTED} mb-2`}>
            Share this secure project link:
          </p>
          <div className={`${OPS_HERO_STAT_INNER} px-3 py-2 text-sm break-all ${OPS_BODY}`}>
            {url}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="accent"
            className="flex-1"
            icon={<Copy size={16} />}
            onClick={() => void handleCopy()}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={`flex-1 ${OPS_OUTLINE_BTN}`}
            icon={<ExternalLink size={16} />}
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          >
            Open Portal
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ClientPortalCreatedModal;
