import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_DISMISSED_PER_OWNER = 500;

function mergeDismissed(existing: string[], incoming: string[]): string[] {
  const set = new Set(existing);
  for (const id of incoming) set.add(id);
  const merged = [...set];
  if (merged.length <= MAX_DISMISSED_PER_OWNER) return merged;
  return merged.slice(merged.length - MAX_DISMISSED_PER_OWNER);
}

interface FieldActivityDismissState {
  dismissedByOwner: Record<string, string[]>;
  dismiss: (ownerId: string, activityId: string) => void;
  dismissAll: (ownerId: string, activityIds: string[]) => void;
  isDismissed: (ownerId: string, activityId: string) => boolean;
}

export const useFieldActivityDismissStore = create<FieldActivityDismissState>()(
  persist(
    (set, get) => ({
      dismissedByOwner: {},

      dismiss: (ownerId, activityId) => {
        set((state) => {
          const prev = state.dismissedByOwner[ownerId] ?? [];
          if (prev.includes(activityId)) return state;
          return {
            dismissedByOwner: {
              ...state.dismissedByOwner,
              [ownerId]: mergeDismissed(prev, [activityId]),
            },
          };
        });
      },

      dismissAll: (ownerId, activityIds) => {
        if (activityIds.length === 0) return;
        set((state) => ({
          dismissedByOwner: {
            ...state.dismissedByOwner,
            [ownerId]: mergeDismissed(state.dismissedByOwner[ownerId] ?? [], activityIds),
          },
        }));
      },

      isDismissed: (ownerId, activityId) => {
        const list = get().dismissedByOwner[ownerId] ?? [];
        return list.includes(activityId);
      },
    }),
    { name: 'cc-field-activity-dismissed' },
  ),
);
