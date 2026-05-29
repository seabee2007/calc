import { create } from 'zustand';
import { ProposalService, type SavedProposal } from '../lib/proposalService';

interface TrackedProposalsState {
  proposals: SavedProposal[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  setProposals: (proposals: SavedProposal[]) => void;
  upsertProposal: (proposal: SavedProposal) => void;
  removeProposal: (id: string) => void;
}

export const useTrackedProposalsStore = create<TrackedProposalsState>((set) => ({
  proposals: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const data = await ProposalService.getAll();
      set({ proposals: data, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load proposals',
      });
    }
  },

  setProposals: (proposals) => set({ proposals, error: null }),

  upsertProposal: (proposal) =>
    set((state) => {
      const index = state.proposals.findIndex((p) => p.id === proposal.id);
      if (index === -1) {
        return { proposals: [proposal, ...state.proposals] };
      }
      const next = [...state.proposals];
      next[index] = proposal;
      return { proposals: next };
    }),

  removeProposal: (id) =>
    set((state) => ({
      proposals: state.proposals.filter((p) => p.id !== id),
    })),
}));
