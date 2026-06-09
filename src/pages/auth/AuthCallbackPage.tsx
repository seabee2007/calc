import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function finishLogin() {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);

      if (!active) return;

      if (error) {
        console.error('[AuthCallback] OAuth callback failed:', error);
        navigate('/login?error=oauth', {
          replace: true,
          state: { message: 'Social login failed. Please try again.' },
        });
        return;
      }

      navigate('/', { replace: true });
    }

    void finishLogin();

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
