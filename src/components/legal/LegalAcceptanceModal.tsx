import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, FileText, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '../../constants/legalVersions';
import { LEGAL_MODAL_META } from './legalModalStyles';
import Button from '../ui/Button';

interface LegalAcceptanceModalProps {
  onAccept: () => Promise<void>;
  isAccepting?: boolean;
  loadError?: string | null;
}

const LegalAcceptanceModal: React.FC<LegalAcceptanceModalProps> = ({
  onAccept,
  isAccepting = false,
  loadError = null,
}) => {
  const { signOut } = useAuth();
  const [checked, setChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleAccept = async () => {
    if (!checked || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onAccept();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save acceptance. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const openLegalDocument = (path: '/terms' | '/privacy') => {
    window.open(path, '_blank', 'noopener,noreferrer');
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm dark:bg-black/80"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-acceptance-title"
      data-testid="legal-acceptance-modal"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl shadow-slate-900/10 dark:border-slate-700/70 dark:bg-slate-900 dark:shadow-black/40 sm:p-8">
        <div className="mb-6 space-y-2">
          <h1
            id="legal-acceptance-title"
            className="text-xl font-semibold text-slate-900 dark:text-slate-50"
          >
            Review and Accept Terms
          </h1>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Before continuing, please review and accept the current Terms of Service and Privacy
            Policy. These documents explain your responsibilities when using Arden Project OS for
            estimates, proposals, schedules, exports, emails, billing, and project records.
          </p>
        </div>

        <div
          className="mb-6 space-y-1 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-800/50"
          data-testid="legal-acceptance-versions"
        >
          <p className={LEGAL_MODAL_META}>
            Terms of Service version:{' '}
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {CURRENT_TERMS_VERSION}
            </span>
          </p>
          <p className={LEGAL_MODAL_META}>
            Privacy Policy version:{' '}
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {CURRENT_PRIVACY_VERSION}
            </span>
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => openLegalDocument('/terms')}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700/80"
          >
            <FileText className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
            View Terms of Service
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => openLegalDocument('/privacy')}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700/80"
          >
            <Shield className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
            View Privacy Policy
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          </button>
        </div>

        <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700/60 dark:bg-slate-800/30">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600 dark:bg-slate-900"
            data-testid="legal-acceptance-checkbox"
          />
          <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            I have read and agree to the Terms of Service and Privacy Policy.
          </span>
        </label>

        {loadError ? (
          <p className="mb-4 text-sm text-amber-700 dark:text-amber-300" role="status">
            {loadError}
          </p>
        ) : null}

        {submitError ? (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400" role="alert">
            {submitError}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleLogout()}
            disabled={isSubmitting || isAccepting}
            data-testid="legal-acceptance-logout"
          >
            Log Out
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleAccept()}
            disabled={!checked || isSubmitting || isAccepting}
            data-testid="legal-acceptance-submit"
          >
            {isSubmitting || isAccepting ? 'Saving…' : 'Accept and Continue'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default LegalAcceptanceModal;
