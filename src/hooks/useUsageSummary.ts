import { useCallback, useEffect, useState } from 'react';
import { fetchUsageSummary, type UsageSummary } from '../services/usageSummaryService';

export interface UseUsageSummaryResult {
  summary: UsageSummary | null;
  loading: boolean;
  error: string | null;
  ownerOnlyBlocked: boolean;
  refetch: () => Promise<void>;
}

export function useUsageSummary(enabled = true): UseUsageSummaryResult {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [ownerOnlyBlocked, setOwnerOnlyBlocked] = useState(false);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    setOwnerOnlyBlocked(false);
    try {
      const data = await fetchUsageSummary();
      setSummary(data);
    } catch (err) {
      setSummary(null);
      const message = err instanceof Error ? err.message : 'Could not load usage summary.';
      if (message.includes('company owners only')) {
        setOwnerOnlyBlocked(true);
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { summary, loading, error, ownerOnlyBlocked, refetch };
}
