import { useCharacterStore, CharacterStore } from './stores/characterStore';
import { useChatStore, ChatStore } from './stores/chatStore';
import { useSettingsStore, SettingsStore } from './stores/settingsStore';
import { useUIStore, UIStore } from './stores/uiStore';
import { useWorldStore, WorldStore } from './stores/worldStore';

type AppStore = CharacterStore & ChatStore & SettingsStore & UIStore & WorldStore;

/**
 * A facade hook to aggregate all individual Zustand stores into a single
 * convenient access point. This simplifies component logic by providing a
 * unified state and actions object.
 *
 * Note: This is not a single Zustand store but a custom hook. Using it
 * without selectors will cause components to re-render on any state change
 * in any of the underlying stores. For performance-critical components,
 * consider using the individual stores with selectors.
 */
export const useAppStore = (): AppStore => {
  const characterState = useCharacterStore();
  const chatState = useChatStore();
  const settingsState = useSettingsStore();
  const uiState = useUIStore();
  const worldState = useWorldStore();

  return {
    ...characterState,
    ...chatState,
    ...settingsState,
    ...uiState,
    ...worldState,
  };
};
