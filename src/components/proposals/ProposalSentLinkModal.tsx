import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { soundService } from '../../services/soundService';
import { hapticService } from '../../services/hapticService';

interface ProposalSentLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposalUrl: string;
}

const ProposalSentLinkModal: React.FC<ProposalSentLinkModalProps> = ({
  isOpen,
  onClose,
  proposalUrl,
}) => {
  const [copied, setCopied] = useState(false);
  const canShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!isOpen) setCopied(false);
  }, [isOpen, proposalUrl]);

  const copyProposalLink = async () => {
    try {
      await navigator.clipboard.writeText(proposalUrl);
      soundService.play('save');
      void hapticService.selection();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const shareProposalLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Concrete Proposal',
          text: 'Here is your concrete proposal:',
          url: proposalUrl,
        });
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          await copyProposalLink();
        }
      }
    } else {
      await copyProposalLink();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Proposal Sent" size="md">
      <div className="space-y-4">
        <p className="text-gray-600 dark:text-slate-300">
          Share this link with your client:
        </p>

        <a
          href={proposalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block break-all rounded-xl border border-blue-500/40 bg-slate-100 p-3 text-blue-700 underline dark:bg-slate-900 dark:text-blue-300"
        >
          {proposalUrl}
        </a>

        {copied && (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Link copied!
          </p>
        )}

        <div className={`flex gap-3 ${canShare ? '' : ''}`}>
          <button
            type="button"
            onClick={() => void copyProposalLink()}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Copy Link
          </button>

          {canShare && (
            <button
              type="button"
              onClick={() => void shareProposalLink()}
              className="flex-1 rounded-xl bg-slate-700 px-4 py-3 font-semibold text-white hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500"
            >
              Share
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ProposalSentLinkModal;
