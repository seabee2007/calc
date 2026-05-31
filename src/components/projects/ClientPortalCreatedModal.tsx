import React, { useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { getClientPortalUrl } from '../../services/clientPortalService';

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
          <p className="text-sm text-gray-500 dark:text-gray-400">Client</p>
          <p className="font-medium text-gray-900 dark:text-white">{clientName}</p>
        </div>

        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Share this secure project link:
          </p>
          <div className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 break-all">
            {url}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            className="flex-1"
            icon={<Copy size={16} />}
            onClick={() => void handleCopy()}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
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
