import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { consumeLoginIntent } from '../../lib/loginIntent';
import { consumePendingProjectInviteToken } from '../../services/projectInviteService';
import { resolvePostLoginDest } from './Login';
import {
  applyFieldEmployeeProfileLinking,
  loadAuthenticatedUserProfile,
  resolveFieldPortalLoginError,
} from './postAuthRouting';

async function navigateAfterAuth(
  navigate: ReturnType<typeof useNavigate>,
): Promise<void> {
  const pendingProjectInvite = consumePendingProjectInviteToken();
  if (pendingProjectInvite) {
    navigate(`/invite/${pendingProjectInvite}`, { replace: true });
    return;
  }

  const loginIntent = consumeLoginIntent();

  try {
    await applyFieldEmployeeProfileLinking({ loginIntent });
  } catch (syncErr) {
    console.warn('[AuthCallback] Field employee profile sync failed:', syncErr);
  }

  const profile = await loadAuthenticatedUserProfile(loginIntent);
  const fieldPortalError = resolveFieldPortalLoginError(profile, loginIntent);
  if (fieldPortalError) {
    navigate('/login', {
      replace: true,
      state: { message: fieldPortalError },
    });
    return;
  }

  const dest = resolvePostLoginDest(profile?.role);

  navigate(dest, { replace: true });
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const oauthError = params.get('error_description') ?? params.get('error');

      if (oauthError) {
        navigate('/login?error=oauth', {
          replace: true,
          state: { message: 'Social login failed. Please try again.' },
        });
        return;
      }

      // Session may already exist (detectSessionInUrl or prior StrictMode exchange pass).
      const { data: { session: existingSession } } = await supabase.auth.getSession();

      if (!active) return;

      if (existingSession) {
        await navigateAfterAuth(navigate);
        return;
      }

      if (!code) {
        navigate('/login?error=missing-code', { replace: true });
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!active) return;

      if (error) {
        console.error('[AuthCallback] OAuth callback failed:', error);
        navigate('/login?error=oauth', {
          replace: true,
          state: { message: 'Social login failed. Please try again.' },
        });
        return;
      }

      await navigateAfterAuth(navigate);
    }

    void handleCallback();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-white dark:bg-gray-900">
      <p className="text-gray-700 dark:text-gray-200">Signing you in...</p>
    </div>
  );
}
