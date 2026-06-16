import { useCallback, useEffect, useState } from 'react';
import { getVerifiedAuthUser } from '../lib/authSession';
import { bootstrapAuthenticatedUser } from '../services/authBootstrapService';
import { useAuth } from './useAuth';

export type AuthBootstrapPhase =
  | 'unauthenticated'
  | 'loading'
  | 'ready'
  | 'error';

export function useAuthBootstrap() {
  const { user, loading: authLoading, profileLoading, refreshProfile } = useAuth();
  const [phase, setPhase] = useState<AuthBootstrapPhase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (authLoading) {
      setPhase('loading');
      return;
    }

    if (!user) {
      setPhase('unauthenticated');
      setError(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setPhase('loading');
      setError(null);

      try {
        const verified = await getVerifiedAuthUser();
        if (!verified) {
          if (!cancelled) setPhase('ready');
          return;
        }

        await bootstrapAuthenticatedUser(verified.id, verified.email ?? undefined);
        await refreshProfile();

        if (!cancelled) setPhase('ready');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to prepare your account.');
          setPhase('error');
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading, refreshProfile, attempt]);

  const bootstrapReady =
    phase === 'unauthenticated' ||
    (phase === 'ready' && !profileLoading);

  return {
    bootstrapReady,
    bootstrapPhase: phase,
    bootstrapError: error,
    retryBootstrap: retry,
  };
}
