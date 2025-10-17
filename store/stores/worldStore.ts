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
        const existingIds = new Set(get().worlds.map((w) => w.id));
        const newWorlds = imported.filter(
          (iw) => iw && typeof iw === 'object' && 'id' in iw && 'name' in iw && 'entries' in iw && !existingIds.has(iw.id),
        );
        set((state) => ({ worlds: [...state.worlds, ...newWorlds] }));
        alert(`${newWorlds.length} new world(s) imported successfully!`);
      },

      logWorldEntryInteraction: (worldId, entryId) => {
        set((state) => {
          const interactions = JSON.parse(JSON.stringify(state.worldEntryInteractions));
          if (!interactions[worldId]) interactions[worldId] = {};
          if (!interactions[worldId][entryId]) interactions[worldId][entryId] = { viewCount: 0, lastViewed: 0 };
          interactions[worldId][entryId].viewCount += 1;
          interactions[worldId][entryId].lastViewed = Date.now();
          return { worldEntryInteractions: interactions };
        });
      },
    }),
    {
      name: 'roleplay-nexus-worlds',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
