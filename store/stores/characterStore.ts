import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Character, LLMProvider } from '../../types';
import { generateCharacterProfile as generateProfile } from '../../services/llmService';
import { useUIStore } from './uiStore';
import { useChatStore } from './chatStore';
import { useSettingsStore } from './settingsStore';
import { GM_CHARACTER, GM_CHARACTER_ID, DEFAULT_CHARACTER } from '../../constants';
import { ERROR_MESSAGES } from '../../services/errorMessages';

export interface CharacterState {
  characters: Character[];
}

export interface CharacterActions {
  saveCharacter: (character: Character) => void;
  deleteCharacter: (id: string) => void;
  duplicateCharacter: (id: string) => void;
  importCharacters: (characters: Character[]) => void;
  generateCharacterProfile: (concept: string) => Promise<Partial<Character>>;
  _setCharacters: (characters: Character[]) => void;
}

export type CharacterStore = CharacterState & CharacterActions;

export const useCharacterStore = create<CharacterStore>()(
  persist(
    (set, get) => ({
      // --- Initial State ---
      characters: [GM_CHARACTER, DEFAULT_CHARACTER],

      // --- Actions ---
      _setCharacters: (characters) => set({ characters }),
      saveCharacter: (character) =>
        set((state) => ({
          characters: state.characters.find((c) => c.id === character.id)
            ? state.characters.map((c) => (c.id === character.id ? character : c))
            : [...state.characters, character],
        })),

      deleteCharacter: (id) => {
        const { characters } = get();
        const charToDelete = characters.find((c) => c.id === id);
        if (!charToDelete || charToDelete.isImmutable) return;

        useUIStore.getState().requestConfirmation(
          () => {
            set((state) => ({
              characters: state.characters.filter((c) => c.id !== id),
            }));
            
            useChatStore.getState().deleteChatsForCharacter(id);

            const { activeCharacterId } = useUIStore.getState();
            if (activeCharacterId === id) {
              useUIStore.getState().resetChatView();
            }
          },
          'Delete Character',
          `Are you sure you want to delete "${charToDelete.name}"? All associated single and group chat histories will also be permanently deleted.`,
          'Delete Character',
          'danger',
        );
      },

      duplicateCharacter: (id) => {
        const char = get().characters.find((c) => c.id === id);
        if (!char) return;
        const newChar = {
          ...char,
          id: crypto.randomUUID(),
          name: `${char.name} (Copy)`,
          isImmutable: false,
        };
        set((state) => ({ characters: [...state.characters, newChar] }));
      },

      importCharacters: (imported) => {
        const existingIds = new Set(get().characters.map((c) => c.id));
        const newChars = imported.filter((ic) => !existingIds.has(ic.id));
        set((state) => ({ characters: [...state.characters, ...newChars] }));
        alert(`${newChars.length} new character(s) imported!`);
      },

      generateCharacterProfile: async (concept) => {
        const { settings } = useSettingsStore.getState();
        const { provider, apiKeys, models } = settings;
        const model = models?.[provider] || '';
        const apiKey = provider === LLMProvider.GEMINI ? process.env.API_KEY || '' : apiKeys[provider];

        if (!apiKey) throw new Error(ERROR_MESSAGES.API_KEY_MISSING(provider));
        if (!model) throw new Error(`Model for ${provider} is not configured. Please check your settings.`);

        const profile = await generateProfile({ provider, apiKey, model, concept });
        return {
          name: profile.name,
          greeting: profile.greeting,
          description: profile.description,
          persona: profile.persona,
        };
      },
    }),
    {
      name: 'roleplay-nexus-characters',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        characters: state.characters.filter(c => !c.isImmutable), // Only persist user-created characters
      }),
      onRehydrateStorage: () => (state) => {
        // After rehydrating user characters, merge them with the immutable default ones.
        if (state) {
            // `state.characters` will contain only non-immutable characters due to `partialize`.
            // Ensure it's an array to prevent errors on first load.
            const userCharacters = state.characters || [];
            
            // The persisted state should NOT contain GM_CHARACTER, but we check just in case.
            const filteredUserCharacters = userCharacters.filter(c => c.id !== GM_CHARACTER_ID);
            
            // Prepend the immutable GM character.
            state.characters = [GM_CHARACTER, ...filteredUserCharacters];
        }
      }
    }
  )
);