import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface ProposalSendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposalTitle: string;
  defaultRecipientEmail?: string;
  sending?: boolean;
  error?: string | null;
  onSend: (recipientEmail: string) => void | Promise<void>;
}

export default function ProposalSendEmailModal({
  isOpen,
  onClose,
  proposalTitle,
  defaultRecipientEmail = '',
  sending = false,
  error = null,
  onSend,
}: ProposalSendEmailModalProps) {
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail);

  useEffect(() => {
    if (isOpen) {
      setRecipientEmail(defaultRecipientEmail);
    }
  }, [defaultRecipientEmail, isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send proposal by email" size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Send <span className="font-medium text-slate-900 dark:text-slate-100">{proposalTitle}</span>{' '}
          to your client. They will receive a public proposal link — no login required.
        </p>

        <Input
          label="Client email"
          type="email"
          value={recipientEmail}
          onChange={(event) => setRecipientEmail(event.target.value)}
          placeholder="client@example.com"
          autoComplete="email"
          disabled={sending}
        />

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={() => void onSend(recipientEmail.trim())}
            disabled={sending || recipientEmail.trim().length === 0}
            isLoading={sending}
          >
            Send email
          </Button>
        </div>
      </div>
    </Modal>
  );
}
