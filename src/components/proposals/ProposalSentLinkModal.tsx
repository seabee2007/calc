import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { soundService } from '../../services/soundService';
import { hapticService } from '../../services/hapticService';

interface ProposalSentLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** @deprecated Use shareUrl */
  proposalUrl?: string;
  shareUrl?: string;
  title?: string;
  shareTitle?: string;
  onEmailClient?: () => void;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

const ProposalSentLinkModal: React.FC<ProposalSentLinkModalProps> = ({
  isOpen,
  onClose,
  proposalUrl,
  shareUrl,
  title = 'Proposal Sent',
  shareTitle = 'Concrete Proposal',
  onEmailClient,
}) => {
  const linkUrl = shareUrl ?? proposalUrl ?? '';
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const canShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setCopyError(false);
    }
  }, [isOpen, linkUrl]);

  const copyProposalLink = async () => {
    setCopyError(false);
    const ok = await copyTextToClipboard(linkUrl);
    if (ok) {
      soundService.play('save');
      void hapticService.selection();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } else {
      setCopied(false);
      setCopyError(true);
    }
  };

  const shareProposalLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: 'Please review this document:',
          url: linkUrl,
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
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        <p className="text-gray-600 dark:text-slate-300">
          Share this link with your client:
        </p>

        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block break-all rounded-xl border border-blue-500/40 bg-slate-100 p-3 text-blue-700 underline dark:bg-slate-900 dark:text-blue-300"
        >
          {linkUrl}
        </a>

        {copied && (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Link copied!
          </p>
        )}
        {copyError && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Tap the link above to open it, or long-press to copy.
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

        {onEmailClient && (
          <button
            type="button"
            onClick={onEmailClient}
            className="w-full rounded-xl border border-blue-500/50 px-4 py-3 font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-slate-800"
          >
            Email client
          </button>
        )}
      </div>
    </Modal>
  );
};

export default ProposalSentLinkModal;
