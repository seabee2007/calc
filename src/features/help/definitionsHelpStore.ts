import { create } from 'zustand';

interface DefinitionsHelpState {
  isOpen: boolean;
  focusTerm: string | null;
  open: (focusTerm?: string) => void;
  close: () => void;
}

export const useDefinitionsHelpStore = create<DefinitionsHelpState>((set) => ({
  isOpen: false,
  focusTerm: null,
  open: (focusTerm) =>
    set({
      isOpen: true,
      focusTerm: focusTerm?.trim() || null,
    }),
  close: () =>
    set({
      isOpen: false,
      focusTerm: null,
    }),
}));
