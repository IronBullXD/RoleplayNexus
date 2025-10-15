import { useMemo } from 'react';
import { useChatStore, Session, GroupSession } from './stores/chatStore';
import { useCharacterStore } from './stores/characterStore';
import { useUIStore } from './stores/uiStore';
import { useWorldStore } from './stores/worldStore';
import { useSettingsStore } from './stores/settingsStore';
import { Character, World, Message } from '../types';

// --- Memoization Helpers ---
const arrayShallowEquals = (a: any[], b: any[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

// --- Single Session Selectors ---
export const useActiveSession = (): [Session | undefined, Character | undefined] => {
  const { activeSessionId, activeCharacterId } = useUIStore();
  const session = useChatStore(state => activeSessionId ? state.sessions[activeSessionId] : undefined);
  const character = useCharacterStore(state => activeCharacterId ? state.characters.find(c => c.id === activeCharacterId) : undefined);
  return [session, character];
};

export const useActiveSessionMessages = (): Message[] => {
  const { activeSessionId } = useUIStore();
  const session = useChatStore(state => activeSessionId ? state.sessions[activeSessionId] : undefined);
  const messages = useChatStore(state => state.messages);
  
  return useMemo(() => {
    if (!session) return [];
    return session.messageIds.map(id => messages[id]).filter(Boolean);
  }, [session, messages]);
};

export const useActiveWorld = (): World | undefined => {
    const { activeSessionId, activeGroupSessionId } = useUIStore();
    const session = useChatStore(state => activeSessionId ? state.sessions[activeSessionId] : undefined);
    const groupSession = useChatStore(state => activeGroupSessionId ? state.groupSessions[activeGroupSessionId] : undefined);
    const worlds = useWorldStore(state => state.worlds);
    
    const worldId = session?.worldId || groupSession?.worldId;
    return useMemo(() => worlds.find(w => w.id === worldId), [worlds, worldId]);
};

// --- Group Session Selectors ---
export const useActiveGroupSession = (): [GroupSession | undefined, Character[]] => {
    const { activeGroupSessionId } = useUIStore();
    const session = useChatStore(state => activeGroupSessionId ? state.groupSessions[activeGroupSessionId] : undefined);
    const characters = useCharacterStore(state => state.characters);
    
    const sessionCharacters = useMemo(() => {
        if (!session) return [];
        const charMap = new Map(characters.map(c => [c.id, c]));
        return session.characterIds.map(id => charMap.get(id)).filter(Boolean) as Character[];
    }, [session, characters]);

    return [session, sessionCharacters];
};

export const useActiveGroupSessionMessages = (): Message[] => {
  const { activeGroupSessionId } = useUIStore();
  const session = useChatStore(state => activeGroupSessionId ? state.groupSessions[activeGroupSessionId] : undefined);
  const messages = useChatStore(state => state.messages);
  
  return useMemo(() => {
    if (!session) return [];
    return session.messageIds.map(id => messages[id]).filter(Boolean);
  }, [session, messages]);
};

// --- Global App State Selector for Debugging ---
export const useAppStateForDebug = (): Record<string, unknown> => {
    const uiState = useUIStore();
    const settingsState = useSettingsStore();
    const charState = useCharacterStore();
    const worldState = useWorldStore();
    const chatState = useChatStore();

    return useMemo(() => {
        const combinedState = {
            ui: { ...uiState },
            settings: { ...settingsState },
            characters: { ...charState },
            worlds: { ...worldState },
            chat: { ...chatState },
        };
        // Remove functions for cleaner logging
        Object.values(combinedState).forEach(slice => {
            Object.keys(slice).forEach(key => {
                if (typeof (slice as any)[key] === 'function') {
                    delete (slice as any)[key];
                }
            });
        });
        return combinedState;
    }, [uiState, settingsState, charState, worldState, chatState]);
}
