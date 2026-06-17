import { create } from 'zustand';

export type DefinitionsHelpSection = 'guide' | 'definitions';

export interface DefinitionsHelpOpenOptions {
  section?: DefinitionsHelpSection;
}

interface DefinitionsHelpState {
  isOpen: boolean;
  focusTerm: string | null;
  activeSection: DefinitionsHelpSection;
  lastSection: DefinitionsHelpSection;
  open: (focusTerm?: string, options?: DefinitionsHelpOpenOptions) => void;
  close: () => void;
  setActiveSection: (section: DefinitionsHelpSection) => void;
}

function resolveSection(
  focusTerm: string | null,
  options: DefinitionsHelpOpenOptions | undefined,
  lastSection: DefinitionsHelpSection,
): DefinitionsHelpSection {
  if (focusTerm) {
    return 'definitions';
  }
  if (options?.section) {
    return options.section;
  }
  return lastSection;
}

export const useDefinitionsHelpStore = create<DefinitionsHelpState>((set, get) => ({
  isOpen: false,
  focusTerm: null,
  activeSection: 'definitions',
  lastSection: 'definitions',
  open: (focusTerm, options) => {
    const trimmedFocus = focusTerm?.trim() || null;
    const section = resolveSection(trimmedFocus, options, get().lastSection);
    set({
      isOpen: true,
      focusTerm: trimmedFocus,
      activeSection: section,
      lastSection: section,
    });
  },
  close: () =>
    set({
      isOpen: false,
      focusTerm: null,
    }),
  setActiveSection: (section) =>
    set({
      activeSection: section,
      lastSection: section,
    }),
}));
