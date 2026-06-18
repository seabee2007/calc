import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '../ui/Button';
import ModalShell from '../ui/ModalShell';
import Select from '../ui/Select';
import { SUPPORT_EMAIL } from '../../config/brand';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { sendSupportRequest } from '../../services/supportRequestService';
import {
  SUPPORT_REQUEST_TOPIC_OPTIONS,
  buildSupportTopicDefaults,
  getBrowserInfo,
  type SupportRequestTopicId,
  type SupportTemplateContext,
} from '../../features/support/supportRequestTopics';
import { validateSupportRequestForm } from '../../features/support/supportRequestValidation';

interface SupportRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function buildTemplateContext(
  contactEmail: string,
  planName: string | null | undefined,
): SupportTemplateContext {
  return {
    userEmail: contactEmail || '[Your account email]',
    browserInfo: getBrowserInfo(),
    planName,
  };
}

export default function SupportRequestModal({ isOpen, onClose }: SupportRequestModalProps) {
  const { user } = useAuth();
  const { plan } = useSubscription();

  const defaultContactEmail = user?.email?.trim() ?? '';
  const requireContactEmail = !defaultContactEmail;

  const [topicId, setTopicId] = useState<SupportRequestTopicId>('billing');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState(defaultContactEmail);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  const appliedDefaultsRef = useRef(buildSupportTopicDefaults('billing', buildTemplateContext('', plan)));

  const templateContext = useMemo(
    () => buildTemplateContext(contactEmail || defaultContactEmail, plan),
    [contactEmail, defaultContactEmail, plan],
  );

  const resetForm = useCallback(() => {
    const defaults = buildSupportTopicDefaults('billing', buildTemplateContext(defaultContactEmail, plan));
    appliedDefaultsRef.current = defaults;
    setTopicId(defaults.topicId);
    setSubject(defaults.subject);
    setMessage(defaults.message);
    setContactEmail(defaultContactEmail);
    setError(null);
    setSuccessEmail(null);
  }, [defaultContactEmail, plan]);

  useEffect(() => {
    if (!isOpen) return;
    resetForm();
  }, [isOpen, resetForm]);

  const handleTopicChange = (nextTopicId: SupportRequestTopicId) => {
    const previousDefaults = appliedDefaultsRef.current;
    const nextDefaults = buildSupportTopicDefaults(nextTopicId, templateContext);

    setTopicId(nextTopicId);
    setSubject((current) =>
      current.trim() === previousDefaults.subject.trim() || !current.trim()
        ? nextDefaults.subject
        : current,
    );
    setMessage((current) =>
      current.trim() === previousDefaults.message.trim() || !current.trim()
        ? nextDefaults.message
        : current,
    );

    appliedDefaultsRef.current = nextDefaults;
  };

  const handleSubmit = async () => {
    const validation = validateSupportRequestForm(
      { topicId, subject, message, contactEmail },
      { requireContactEmail },
    );

    if (!validation.ok) {
      setError(Object.values(validation.errors).find(Boolean) ?? 'Please fix the highlighted fields.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const topicLabel = SUPPORT_REQUEST_TOPIC_OPTIONS.find((option) => option.id === topicId)?.label ?? topicId;
      const resolvedEmail = (contactEmail || defaultContactEmail).trim();

      const result = await sendSupportRequest({
        topic: topicId,
        subject: subject.trim(),
        message: message.trim(),
        contactEmail: resolvedEmail,
        pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: getBrowserInfo(),
        metadata: { topicLabel },
      });

      if (!result.ok) {
        setError(
          result.error ??
            'Could not send support request. Please try again or email support@ardenprojectos.com directly.',
        );
        return;
      }

      setSuccessEmail(resolvedEmail);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not send support request. Please try again or email support@ardenprojectos.com directly.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const topicOptions = useMemo(
    () =>
      SUPPORT_REQUEST_TOPIC_OPTIONS.map((option) => ({
        value: option.id,
        label: option.label,
      })),
    [],
  );

  const inputClassName =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Contact Support"
      subtitle="Tell us what you need help with and we'll get back to you."
      size="lg"
      footer={
        successEmail ? (
          <div className="flex w-full justify-end">
            <Button variant="primary" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? 'Sending…' : 'Send request'}
            </Button>
          </div>
        )
      }
    >
      {successEmail ? (
        <div
          role="status"
          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-slate-800 dark:text-slate-100"
        >
          Support request sent. We'll get back to you at {successEmail}.
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="support-topic" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Support topic
            </label>
            <Select
              id="support-topic"
              value={topicId}
              onChange={(value) => handleTopicChange(value as SupportRequestTopicId)}
              options={topicOptions}
            />
          </div>

          <div>
            <label htmlFor="support-subject" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Subject
            </label>
            <input
              id="support-subject"
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={topicId === 'other' ? 'Enter your subject' : 'Subject'}
              className={inputClassName}
              maxLength={120}
            />
          </div>

          {requireContactEmail ? (
            <div>
              <label htmlFor="support-contact-email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Your email
              </label>
              <input
                id="support-contact-email"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="you@example.com"
                className={inputClassName}
                autoComplete="email"
              />
            </div>
          ) : null}

          <div>
            <label htmlFor="support-message" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Message
            </label>
            <textarea
              id="support-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={12}
              className={`${inputClassName} min-h-[220px] resize-y`}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            You can also email us directly at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-cyan-700 underline underline-offset-2 dark:text-cyan-400">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>
      )}
    </ModalShell>
  );
}
