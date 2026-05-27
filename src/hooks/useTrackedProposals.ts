import { useCallback, useEffect, useState } from 'react';
import { ProposalService, type SavedProposal } from '../lib/proposalService';
import { useAuth } from './useAuth';

export function useTrackedProposals() {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<SavedProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setProposals([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await ProposalService.getAll();
      setProposals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposals');
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { proposals, loading, error, refresh };
}
