import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Settings, Persona, Theme } from '../../types';
import { DEFAULT_SETTINGS, DEFAULT_USER_PERSONA } from '../../constants';
import { useUIStore } from './uiStore';

export interface SettingsState {
  settings: Settings;
  userPersona: Persona;
  themes: Theme[];
  activeThemeId: string;
}

export interface SettingsActions {
  saveSettings: (settings: Settings) => void;
  savePersona: (persona: Persona) => void;
  saveTheme: (theme: Theme) => void;
  deleteTheme: (themeId: string) => void;
  setActiveTheme: (themeId: string) => void;
  _setThemes: (themes: Theme[]) => void;
}

export type SettingsStore = SettingsState & SettingsActions;

const defaultThemes: Theme[] = [
  { id: 'cyber-noir', name: 'Cyber Noir', isImmutable: true, config: { primary: '#ef4444', secondary: '#f97316', neutral: '#0A0B0F', text: '#F1F2F5' } },
  { id: 'deep-forest', name: 'Deep Forest', isImmutable: true, config: { primary: '#22c55e', secondary: '#a16207', neutral: '#1c1917', text: '#f5f5f4' } },
  { id: 'arcane-void', name: 'Arcane Void', isImmutable: true, config: { primary: '#a855f7', secondary: '#06b6d4', neutral: '#100c14', text: '#f0e8f8' } },
  { id: 'solar-flare', name: 'Solar Flare', isImmutable: true, config: { primary: '#facc15', secondary: '#dc2626', neutral: '#18181b', text: '#fefce8' } },
  { id: 'oceanic-depths', name: 'Oceanic Depths', isImmutable: true, config: { primary: '#3b82f6', secondary: '#14b8a6', neutral: '#0c1424', text: '#e0f2fe' } },
  { id: 'rose-quartz', name: 'Rose Quartz', isImmutable: true, config: { primary: '#f472b6', secondary: '#c084fc', neutral: '#1c1917', text: '#fdf2f8' } },
  { id: 'synthwave-sunset', name: 'Synthwave Sunset', isImmutable: true, config: { primary: '#ec4899', secondary: '#22d3ee', neutral: '#190f2b', text: '#f5f3ff' } },
];

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // --- Initial State ---
      settings: DEFAULT_SETTINGS,
      userPersona: DEFAULT_USER_PERSONA,
      themes: defaultThemes,
      activeThemeId: 'cyber-noir',

      // --- Actions ---
      saveSettings: (newSettings) => set({ settings: newSettings }),
      savePersona: (persona) => set({ userPersona: persona }),
      _setThemes: (themes) => set({ themes }),

      saveTheme: (theme) => {
        set((state) => ({
          themes: state.themes.find((t) => t.id === theme.id)
            ? state.themes.map((t) => (t.id === theme.id ? theme : t))
            : [...state.themes, theme],
        }));
      },

      deleteTheme: (themeId) => {
        const { themes } = get();
        const theme = themes.find((t) => t.id === themeId);
        if (!theme || theme.isImmutable) return;

        useUIStore.getState().requestConfirmation(
          () => {
            set((state) => {
              const newThemes = state.themes.filter((t) => t.id !== themeId);
              const newActiveThemeId =
                state.activeThemeId === themeId ? 'cyber-noir' : state.activeThemeId;
              return { themes: newThemes, activeThemeId: newActiveThemeId };
            });
          },
          'Delete Theme',
          `Are you sure you want to delete the theme "${theme.name}"?`,
          'Delete',
          'danger',
        );
      },
      setActiveTheme: (themeId) => set({ activeThemeId: themeId }),
    }),
    {
      name: 'roleplay-nexus-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
        userPersona: state.userPersona,
        themes: state.themes.filter(t => !t.isImmutable), // only persist user themes
        activeThemeId: state.activeThemeId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Get user themes from storage, default to empty array if not present.
          const userThemes = state.themes || [];
          // Create a Set of user theme IDs for efficient lookup to avoid duplicates.
          const userThemeIds = new Set(userThemes.map(t => t.id));
          // Filter default themes to exclude any that might have been overridden by a user theme with the same ID.
          const uniqueDefaultThemes = defaultThemes.filter(t => !userThemeIds.has(t.id));
          
          state.themes = [...userThemes, ...uniqueDefaultThemes];
        }
      }
    }
  )
);
