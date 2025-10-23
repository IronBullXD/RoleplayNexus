import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { World } from '../../types';
import { useUIStore } from './uiStore';
import { useChatStore } from './chatStore';
import { useSettingsStore } from './settingsStore';

export interface WorldState {
  worlds: World[];
  worldEntryInteractions: Record<string, Record<string, { viewCount: number; lastViewed: number }>>;
}

export interface WorldActions {
  saveWorld: (world: World) => void;
  deleteWorld: (id: string) => void;
  importWorlds: (worlds: World[]) => void;
  logWorldEntryInteraction: (worldId: string, entryId: string) => void;
}

export type WorldStore = WorldState & WorldActions;

export const useWorldStore = create<WorldStore>()(
  persist(
    (set, get) => ({
      // --- Initial State ---
      worlds: [],
      worldEntryInteractions: {},

      // --- Actions ---
      saveWorld: (world) => {
        // Validate world before saving
        if (!world.id || typeof world.id !== 'string') {
          console.error('Invalid world: missing or invalid id');
          return;
        }
        
        if (!world.name || typeof world.name !== 'string' || world.name.trim().length === 0) {
          console.error('Invalid world: missing or invalid name');
          return;
        }

        if (!Array.isArray(world.entries)) {
          console.error('Invalid world: entries must be an array');
          return;
        }
        
        // Validate entries
        for (const entry of world.entries) {
          if (!entry.id || typeof entry.id !== 'string') {
            console.error('Invalid world entry: missing or invalid id');
            return;
          }
          if (!entry.content || typeof entry.content !== 'string') {
            console.error('Invalid world entry: missing or invalid content');
            return;
          }
        }

        set((state) => {
          const now = Date.now();
          const existingWorld = state.worlds.find((w) => w.id === world.id);

          if (existingWorld) {
            // Update existing world
            const updatedWorld = { ...existingWorld, ...world, lastModified: now };
            return {
              worlds: state.worlds.map((w) => (w.id === world.id ? updatedWorld : w)),
            };
          } else {
            // Create new world
            const newWorld = { ...world, createdAt: now, lastModified: now };
            return { worlds: [...state.worlds, newWorld] };
          }
        });
      },

      deleteWorld: (id) => {
        const { worlds } = get();
        const worldToDelete = worlds.find((w) => w.id === id);
        if (!worldToDelete) return;

        useUIStore.getState().requestConfirmation(
          () => {
            set((state) => ({
              worlds: state.worlds.filter((w) => w.id !== id),
            }));
            
            useChatStore.getState().unlinkWorldFromAllSessions(id);

            const { settings, saveSettings } = useSettingsStore.getState();
            if (settings.worldId === id) {
              saveSettings({ ...settings, worldId: null });
            }
          },
          'Delete World',
          `Are you sure you want to delete the world "${worldToDelete.name}"? This will unlink it from any chats, but will not delete the chats themselves.`,
          'Delete World',
          'danger',
        );
      },

      importWorlds: (imported) => {
        try {
          if (!Array.isArray(imported)) {
            throw new Error('Imported data must be an array');
          }
          
          const existingIds = new Set(get().worlds.map((w) => w.id));
          const newWorlds = imported.filter(
            (iw) => {
              try {
                return iw && 
                       typeof iw === 'object' && 
                       'id' in iw && 
                       'name' in iw && 
                       'entries' in iw && 
                       typeof iw.id === 'string' &&
                       typeof iw.name === 'string' &&
                       Array.isArray(iw.entries) &&
                       !existingIds.has(iw.id);
              } catch {
                return false; // Skip invalid entries
              }
            }
          );
          
          if (newWorlds.length > 0) {
            set((state) => ({ worlds: [...state.worlds, ...newWorlds] }));
            alert(`${newWorlds.length} new world(s) imported successfully!`);
          } else {
            alert('No valid new worlds found to import.');
          }
        } catch (error) {
          console.error('Error importing worlds:', error);
          alert(`Failed to import worlds: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },

      logWorldEntryInteraction: (worldId, entryId) => {
        set((state) => {
          const newInteractions = {
            ...state.worldEntryInteractions,
            [worldId]: {
              ...(state.worldEntryInteractions[worldId] || {}),
              [entryId]: {
                viewCount: ((state.worldEntryInteractions[worldId]?.[entryId]?.viewCount) || 0) + 1,
                lastViewed: Date.now(),
              },
            },
          };
          return { worldEntryInteractions: newInteractions };
        });
      },
    }),
    {
      name: 'roleplay-nexus-worlds',
      storage: createJSONStorage(() => localStorage),
    }
  )
);