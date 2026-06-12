import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import type { UserLegalAcceptance } from '../types/legalAcceptance';
import {
  acceptCurrentLegalDocuments,
  clearLegalAcceptanceSessionCache,
  getCurrentLegalAcceptance,
  getLatestLegalAcceptance,
  isJwtIssuedAtFutureError,
  readLegalAcceptanceSessionCache,
} from '../services/legalAcceptanceService';

export function useLegalAcceptance() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [latestAcceptance, setLatestAcceptance] = useState<UserLegalAcceptance | null>(null);
  const [hasAcceptedCurrentLegal, setHasAcceptedCurrentLegal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSessionError, setIsSessionError] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setLatestAcceptance(null);
      setHasAcceptedCurrentLegal(false);
      setIsLoading(false);
      setError(null);
      setIsSessionError(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsSessionError(false);

    try {
      if (readLegalAcceptanceSessionCache(user.id)) {
        const cached = await getCurrentLegalAcceptance(user.id);
        if (cached) {
          setLatestAcceptance(cached);
          setHasAcceptedCurrentLegal(true);
          return;
        }
        clearLegalAcceptanceSessionCache(user.id);
      }

      const [current, latest] = await Promise.all([
        getCurrentLegalAcceptance(user.id),
        getLatestLegalAcceptance(user.id),
      ]);

      setLatestAcceptance(current ?? latest);
      setHasAcceptedCurrentLegal(!!current);
    } catch (err) {
      console.error('Error loading legal acceptance:', err);
      const message = err instanceof Error ? err.message : 'Failed to load legal acceptance';
      setError(message);
      setIsSessionError(isJwtIssuedAtFutureError(err));
      setLatestAcceptance(null);
      setHasAcceptedCurrentLegal(false);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const acceptLegalDocuments = useCallback(async () => {
    if (!user?.id) {
      throw new Error('Not authenticated');
    }

    setIsAccepting(true);
    setError(null);
    setIsSessionError(false);

    try {
      const acceptance = await acceptCurrentLegalDocuments(user.id);
      setLatestAcceptance(acceptance);
      setHasAcceptedCurrentLegal(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save acceptance';
      setError(message);
      setIsSessionError(isJwtIssuedAtFutureError(err));
      throw err;
    } finally {
      setIsAccepting(false);
    }
  }, [user?.id]);

  return {
    isLoading: !!user && isLoading,
    isAccepting: !!user && isAccepting,
    hasAcceptedCurrentLegal: !!user && hasAcceptedCurrentLegal,
    latestAcceptance,
    acceptLegalDocuments,
    refresh,
    error,
    isSessionError,
  };
}
