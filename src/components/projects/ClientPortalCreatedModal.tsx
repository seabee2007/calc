import React, { useState } from 'react';
import { Copy, ExternalLink, X } from 'lucide-react';
import Button from '../ui/Button';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Client Portal Created
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
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
      </div>
    </div>
  );
};

export default ClientPortalCreatedModal;
