import { useCallback, useEffect, useState } from 'react';
import { ProposalService, type SavedProposal } from '../lib/proposalService';
import { useAuth } from './useAuth';

/** Avoid dashboard flash: keep last fetch across route remounts. */
let cachedProposals: SavedProposal[] = [];
let cachedUserId: string | null = null;
let cacheReady = false;

function hasWarmCache(userId: string | undefined): boolean {
  return Boolean(userId && cachedUserId === userId && cacheReady);
}

export function seedTrackedProposalsCache(userId: string, proposals: SavedProposal[]) {
  cachedUserId = userId;
  cachedProposals = proposals;
  cacheReady = true;
}

export function useTrackedProposals() {
  const { user } = useAuth();
  const userId = user?.id;

  const [proposals, setProposals] = useState<SavedProposal[]>(() =>
    hasWarmCache(userId) ? cachedProposals : [],
  );
  const [loading, setLoading] = useState(() => !hasWarmCache(userId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProposals([]);
      cachedProposals = [];
      cachedUserId = null;
      cacheReady = false;
      setLoading(false);
      return;
    }

    const showBlockingLoad = !hasWarmCache(userId);
    try {
      if (showBlockingLoad) setLoading(true);
      setError(null);
      const data = await ProposalService.getAll();
      seedTrackedProposalsCache(userId, data);
      setProposals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposals');
      if (showBlockingLoad) {
        setProposals([]);
        cachedProposals = [];
        cacheReady = false;
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId && hasWarmCache(userId)) {
      setProposals(cachedProposals);
    }
    void refresh();
  }, [refresh, userId]);

  return { proposals, loading, error, refresh };
}
