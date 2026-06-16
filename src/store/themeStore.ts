import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { updateUserPreferences } from '../services/userPreferencesService';
import type { ThemeMode } from '../types';

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setIsDark: (isDark: boolean) => void;
}

function themeModeFromIsDark(isDark: boolean): ThemeMode {
  return isDark ? 'dark' : 'light';
}

function persistThemeMode(isDark: boolean): void {
  void updateUserPreferences({ themeMode: themeModeFromIsDark(isDark) }).catch((error) => {
    if (import.meta.env.DEV) {
      console.error('Error persisting theme preference:', error);
    }
  });
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
      toggleTheme: () => {
        const nextIsDark = !get().isDark;
        set({ isDark: nextIsDark });
        persistThemeMode(nextIsDark);
      },
      setIsDark: (isDark: boolean) => set({ isDark }),
    }),
    {
      name: 'theme-storage',
    }
  )
);

export function applyThemeModeFromPreferences(themeMode: ThemeMode | null | undefined): void {
  if (themeMode !== 'light' && themeMode !== 'dark') {
    return;
  }

  useThemeStore.getState().setIsDark(themeMode === 'dark');
}
