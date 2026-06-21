import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { logoutAndRedirect } from '../../services/appLogout';
import LegalAcceptanceModal from './LegalAcceptanceModal';
import Button from '../ui/Button';

interface LegalAcceptanceGateProps {
  /** Legal acceptance loading state from App.tsx (single hook instance). */
  isLoading: boolean;
  /** Accept handler from App.tsx — updates parent legal state so routes can render. */
  onAccept: () => Promise<void>;
  error?: string | null;
  isSessionError?: boolean;
  onRetry?: () => void;
  isAccepting?: boolean;
}

/**
 * Blocks authenticated app access until current Terms and Privacy are accepted.
 * Used with Pattern A in App.tsx: early return while not accepted.
 * Does NOT own legal state — App.tsx controls when this component mounts/unmounts.
 */
const LegalAcceptanceGate: React.FC<LegalAcceptanceGateProps> = ({
  isLoading,
  onAccept,
  error,
  isSessionError = false,
  onRetry,
  isAccepting = false,
}) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = () => {
    void logoutAndRedirect(signOut, navigate);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center dark:bg-slate-950">
        <div
          className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
          data-testid="legal-acceptance-loading"
        />
      </div>
    );
  }

  if (isSessionError && error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4 dark:bg-slate-950">
        <div
          className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl dark:border-slate-700/70 dark:bg-slate-900"
          data-testid="legal-acceptance-session-error"
        >
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Session timing issue
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            We could not verify your legal acceptance because your session clock is out of sync.
            Please retry, or sign out and sign back in.
          </p>
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleSignOut}
              data-testid="legal-acceptance-session-signout"
            >
              Sign Out
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => onRetry?.()}
              data-testid="legal-acceptance-session-retry"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LegalAcceptanceModal
      onAccept={onAccept}
      isAccepting={isAccepting}
      loadError={error}
    />
  );
};

export default LegalAcceptanceGate;
