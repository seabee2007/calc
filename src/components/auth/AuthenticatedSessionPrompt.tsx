import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { logoutAndRedirect } from '../../services/appLogout';
import Button from '../ui/Button';

type AuthenticatedSessionPromptProps = {
  continueHref: string;
  continueLabel?: string;
};

export default function AuthenticatedSessionPrompt({
  continueHref,
  continueLabel = 'Continue to your workspace',
}: AuthenticatedSessionPromptProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = React.useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logoutAndRedirect(signOut, navigate);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div
      className="mb-6 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4"
      data-testid="authenticated-session-prompt"
    >
      <p className="text-sm text-slate-200">
        You are already signed in as{' '}
        <span className="font-medium text-white">{user?.email ?? 'your account'}</span>.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="primary"
          className="sm:flex-1"
          onClick={() => navigate(continueHref, { replace: true })}
        >
          {continueLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="sm:flex-1"
          disabled={signingOut}
          onClick={() => void handleSignOut()}
        >
          {signingOut ? 'Signing out…' : 'Sign out and use a different account'}
        </Button>
      </div>
    </div>
  );
}
