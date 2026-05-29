import { useCallback, useEffect } from 'react';
import type { SavedProposal } from '../lib/proposalService';
import { useTrackedProposalsStore } from '../store/trackedProposalsStore';
import { useAuth } from './useAuth';

export function seedTrackedProposalsCache(_userId: string, proposals: SavedProposal[]) {
  useTrackedProposalsStore.getState().setProposals(proposals);
}

export function useTrackedProposals() {
  const { user } = useAuth();
  const userId = user?.id;
  const proposals = useTrackedProposalsStore((s) => s.proposals);
  const loading = useTrackedProposalsStore((s) => s.loading);
  const error = useTrackedProposalsStore((s) => s.error);
  const load = useTrackedProposalsStore((s) => s.load);

  const refresh = useCallback(async () => {
    if (!userId) {
      useTrackedProposalsStore.getState().setProposals([]);
      return;
    }
    await load();
  }, [userId, load]);

  useEffect(() => {
    if (!userId) {
      useTrackedProposalsStore.getState().setProposals([]);
      return;
    }
    void refresh();
  }, [userId, refresh]);

  return { proposals, loading, error, refresh };
}
