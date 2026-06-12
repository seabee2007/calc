import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import {
  validateEmailListInput,
  type ProposalEmailSendPayload,
} from '../../utils/proposalEmailRecipient';
import {
  getClientEmailModalTitle,
  getClientEmailSubjectPreview,
  getClientEmailSubmitLabel,
} from '../../utils/proposalNextActionEmail';
import { normalizeDisplayText } from '../../utils/normalizeDisplayText';
import { FORM_INPUT, FORM_LABEL, TEXT_FOREGROUND } from '../../theme/appTheme';
import { isValidEmailAddress } from '../../../supabase/functions/_shared/emailValidation.ts';

export type ClientEmailActionMode = 'send' | 'followUp' | 'deposit' | 'checkIn';

/** @deprecated Use ClientEmailActionMode */
export type ProposalSendEmailMode = ClientEmailActionMode;

interface ProposalSendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposalTitle: string;
  mode?: ClientEmailActionMode;
  defaultRecipientEmail?: string;
  defaultCcEmails?: string;
  sending?: boolean;
  error?: string | null;
  onSend: (payload: ProposalEmailSendPayload) => void | Promise<void>;
}

export default function ProposalSendEmailModal({
  isOpen,
  onClose,
  proposalTitle,
  mode = 'send',
  defaultRecipientEmail = '',
  defaultCcEmails = '',
  sending = false,
  error = null,
  onSend,
}: ProposalSendEmailModalProps) {
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail);
  const [ccEmails, setCcEmails] = useState(defaultCcEmails);
  const [messageNote, setMessageNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const subjectPreview = useMemo(
    () => getClientEmailSubjectPreview(mode, proposalTitle),
    [mode, proposalTitle],
  );

  useEffect(() => {
    if (isOpen) {
      setRecipientEmail(defaultRecipientEmail);
      setCcEmails(defaultCcEmails);
      setMessageNote('');
      setLocalError(null);
    }
  }, [defaultCcEmails, defaultRecipientEmail, isOpen]);

  const handleSubmit = () => {
    const to = recipientEmail.trim();
    if (!isValidEmailAddress(to)) {
      setLocalError('Enter a valid recipient email address.');
      return;
    }

    const ccValidation = validateEmailListInput(ccEmails);
    if (!ccValidation.ok) {
      setLocalError(ccValidation.message);
      return;
    }

    setLocalError(null);
    void onSend({
      to,
      cc: ccValidation.emails,
      messageNote: messageNote.trim() || undefined,
    });
  };

  const displayError = localError ?? error;
  const title = getClientEmailModalTitle(mode);
  const submitLabel = getClientEmailSubmitLabel(mode);

  const introCopy = (() => {
    switch (mode) {
      case 'followUp':
        return 'Send a professional follow-up with the same public proposal link.';
      case 'deposit':
        return 'Send a deposit request email. Online payment collection is not included unless you add a payment link later.';
      case 'checkIn':
        return 'Send a short professional check-in to your client.';
      default:
        return 'They will receive a public proposal link \u2014 no login required.';
    }
  })();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {normalizeDisplayText(proposalTitle)}
          </span>
          {' \u2014 '}
          {introCopy}
        </p>

        <Input
          label="To"
          type="email"
          value={recipientEmail}
          onChange={(event) => setRecipientEmail(event.target.value)}
          placeholder="client@example.com"
          autoComplete="email"
          disabled={sending}
        />

        <Input
          label="CC"
          type="text"
          value={ccEmails}
          onChange={(event) => setCcEmails(event.target.value)}
          placeholder="owner@example.com, billing@example.com"
          disabled={sending}
        />

        <Input
          label="Subject preview"
          type="text"
          value={subjectPreview}
          readOnly
          disabled
        />

        <div>
          <label className={`mb-1 block text-sm font-medium ${FORM_LABEL} ${TEXT_FOREGROUND}`}>
            Message note (optional)
          </label>
          <textarea
            value={messageNote}
            onChange={(event) => setMessageNote(event.target.value)}
            placeholder="Add a short note to include in the email."
            rows={3}
            disabled={sending}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${FORM_INPUT}`}
          />
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Defaulted from the project client email. You can change it before sending.
        </p>

        {displayError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {displayError}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={handleSubmit}
            disabled={sending || recipientEmail.trim().length === 0}
            isLoading={sending}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
