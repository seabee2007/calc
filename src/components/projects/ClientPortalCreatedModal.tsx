import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, ExternalLink, Mail } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import Toast from '../ui/Toast';
import { buildClientPortalUrl } from '../../services/clientPortalService';
import { sendClientPortalInviteEmail } from '../../services/emailService';
import { useSettingsStore } from '../../store';
import {
  CLIENT_PORTAL_INVITE_SUBJECT,
  applyClientPortalInvitePlaceholders,
  buildClientPortalInviteMessageTemplate,
  isTransactionalEmailEnabled,
} from '../../utils/clientPortalInviteEmail';
import { isValidEmailAddress } from '../../../supabase/functions/_shared/emailValidation.ts';
import {
  OPS_BODY,
  OPS_HERO_STAT_INNER,
  OPS_MUTED,
  OPS_OUTLINE_BTN,
  OPS_TITLE,
} from '../dashboard/opsTheme';
import { FORM_INPUT, FORM_LABEL, TEXT_FOREGROUND } from '../../theme/appTheme';

interface ClientPortalCreatedModalProps {
  clientName: string;
  clientEmail?: string;
  token: string;
  projectId: string;
  onClose: () => void;
  onSent?: () => void;
}

const ClientPortalCreatedModal: React.FC<ClientPortalCreatedModalProps> = ({
  clientName,
  clientEmail = '',
  token,
  projectId,
  onClose,
  onSent,
}) => {
  const companySettings = useSettingsStore((state) => state.companySettings);
  const companyName = companySettings.companyName?.trim() || 'Your contractor';
  const portalUrl = useMemo(() => buildClientPortalUrl(token), [token]);

  const [recipientEmail, setRecipientEmail] = useState(clientEmail);
  const [subject, setSubject] = useState(CLIENT_PORTAL_INVITE_SUBJECT);
  const [messageTemplate, setMessageTemplate] = useState(buildClientPortalInviteMessageTemplate());
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [emailUnavailable, setEmailUnavailable] = useState(!isTransactionalEmailEnabled());
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ show: false, message: '', type: 'success' });

  const resolvedPreviewMessage = useMemo(
    () =>
      applyClientPortalInvitePlaceholders(messageTemplate, {
        clientName: clientName.trim() || 'there',
        portalLink: portalUrl,
        companyName,
      }),
    [clientName, companyName, messageTemplate, portalUrl],
  );

  useEffect(() => {
    setRecipientEmail(clientEmail);
    setSubject(CLIENT_PORTAL_INVITE_SUBJECT);
    setMessageTemplate(buildClientPortalInviteMessageTemplate());
    setLocalError(null);
    setShowPreview(false);
    setEmailUnavailable(!isTransactionalEmailEnabled());
  }, [clientEmail, clientName, token]);

  useEffect(() => {
    if (!toast.show) return;
    const timer = window.setTimeout(() => {
      setToast((current) => ({ ...current, show: false }));
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [toast.show]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvite = async () => {
    const to = recipientEmail.trim();
    if (!to) {
      setLocalError('Add a client email before sending the invite.');
      return;
    }
    if (!isValidEmailAddress(to)) {
      setLocalError('Enter a valid client email address to send the invite.');
      return;
    }

    if (emailUnavailable) {
      setLocalError('Email sending is not configured yet. Copy the link to share manually.');
      return;
    }

    setSending(true);
    setLocalError(null);

    try {
      const result = await sendClientPortalInviteEmail({
        portalToken: token,
        projectId,
        recipientEmail: to,
        emailSubject: subject.trim() || CLIENT_PORTAL_INVITE_SUBJECT,
        messageBody: messageTemplate,
      });

      if (result.disabled || result.skipped) {
        setEmailUnavailable(true);
        setLocalError(
          result.message ??
            'Email sending is not configured yet. Copy the link to share manually.',
        );
        return;
      }

      if (!result.ok) {
        throw new Error(result.error ?? 'Could not send client portal invite.');
      }

      onClose();
      onSent?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not send client portal invite. Try copying the link instead.';
      if (import.meta.env.DEV) {
        console.error('[clientPortalInvite] send failed:', error);
      }
      setLocalError(message);
      setToast({
        show: true,
        message,
        type: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end">
      <Button
        type="button"
        variant="outline"
        className={`${OPS_OUTLINE_BTN} whitespace-nowrap`}
        onClick={onClose}
        disabled={sending}
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant="outline"
        className={`${OPS_OUTLINE_BTN} whitespace-nowrap`}
        icon={<Copy size={16} />}
        onClick={() => void handleCopy()}
        disabled={sending}
        aria-label="Copy portal link"
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
      <Button
        type="button"
        variant="outline"
        className={`${OPS_OUTLINE_BTN} whitespace-nowrap`}
        icon={<ExternalLink size={16} />}
        onClick={() => window.open(portalUrl, '_blank', 'noopener,noreferrer')}
        disabled={sending}
        aria-label="Open client portal"
      >
        Open
      </Button>
      <Button
        type="button"
        variant="accent"
        className="whitespace-nowrap"
        icon={<Mail size={16} />}
        onClick={() => void handleSendInvite()}
        disabled={sending || emailUnavailable}
        isLoading={sending}
        aria-label="Send invite email"
      >
        Send
      </Button>
    </div>
  );

  return (
    <>
      <Modal isOpen title="Send Client Portal Invite" onClose={onClose} size="lg" footer={footer}>
        <div className="space-y-4">
          <div>
            <p className={`text-sm ${OPS_MUTED}`}>Client</p>
            <p className={`font-medium ${OPS_TITLE}`}>{clientName}</p>
          </div>

          <Input
            label="Client email"
            type="email"
            value={recipientEmail}
            onChange={(event) => setRecipientEmail(event.target.value)}
            placeholder="client@example.com"
            autoComplete="email"
            disabled={sending}
          />

          <Input
            label="Email subject"
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={sending}
          />

          <div>
            <label className={`mb-1 block text-sm font-medium ${FORM_LABEL} ${TEXT_FOREGROUND}`}>
              Email message
            </label>
            <textarea
              value={messageTemplate}
              onChange={(event) => setMessageTemplate(event.target.value)}
              rows={6}
              disabled={sending}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${FORM_INPUT}`}
            />
            <p className={`mt-1 text-xs ${OPS_MUTED}`}>
              Placeholders are replaced before sending.
            </p>
          </div>

          <div>
            <button
              type="button"
              className={`flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium ${OPS_TITLE} dark:border-slate-700`}
              onClick={() => setShowPreview((open) => !open)}
              aria-expanded={showPreview}
            >
              Email preview
              {showPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showPreview ? (
              <pre
                className={`${OPS_HERO_STAT_INNER} mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap px-3 py-2 text-xs ${OPS_BODY}`}
                aria-label="Email message preview"
              >
                {resolvedPreviewMessage}
              </pre>
            ) : null}
          </div>

          <div className={`${OPS_HERO_STAT_INNER} px-3 py-2 text-sm ${OPS_BODY}`}>
            <p className={`font-medium ${OPS_TITLE}`}>Secure portal link ready</p>
            <p className={`mt-1 text-xs ${OPS_MUTED}`}>
              Anyone with this link may access the shared client portal. Only send it to authorized
              project contacts.
            </p>
          </div>

          {emailUnavailable ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Email sending is not configured yet. Copy the link to share manually.
            </p>
          ) : null}

          {localError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {localError}
            </p>
          ) : null}
        </div>
      </Modal>

      {toast.show ? (
        <Toast
          id="client-portal-invite"
          title={toast.type === 'success' ? 'Success' : 'Error'}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast((current) => ({ ...current, show: false }))}
        />
      ) : null}
    </>
  );
};

export default ClientPortalCreatedModal;
