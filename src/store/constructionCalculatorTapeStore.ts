import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CalculatorTapeEntry } from '../features/tools/construction-calculator/domain/constructionCalculatorTypes';
import {
  appendTapeEntry,
  capTapeEntries,
  MAX_TAPE_ENTRIES,
} from '../features/tools/construction-calculator/domain/constructionCalculatorTape';

interface ConstructionCalculatorTapeState {
  entries: CalculatorTapeEntry[];
  addEntry: (expression: string, result: string) => void;
  clearTape: () => void;
}

export const useConstructionCalculatorTapeStore = create<ConstructionCalculatorTapeState>()(
  persist(
    (set) => ({
      entries: [],

      addEntry: (expression, result) => {
        set((state) => ({
          entries: appendTapeEntry(state.entries, expression, result),
        }));
      },

      clearTape: () => set({ entries: [] }),
    }),
    {
      name: 'cc-construction-calculator-tape',
      partialize: (state) => ({
        entries: capTapeEntries(state.entries).slice(-MAX_TAPE_ENTRIES),
      }),
    },
  ),
);
