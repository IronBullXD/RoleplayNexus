import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ReactNode } from 'react';
import { Character, Message, Settings, View, ChatSession, GroupChatSession, World, Persona, LLMProvider } from '../types';
import { DEFAULT_CHARACTER, DEFAULT_SETTINGS, DEFAULT_USER_PERSONA, GM_CHARACTER, GM_CHARACTER_ID } from '../constants';
import { getChatCompletionStream, generateCharacterProfile as generateProfile, summarizeMessages } from '../services/llmService';
import { logger } from '../services/logger';

// --- Types ---

type ConfirmationAction = { 
  action: () => void; 
  title: string; 
  message: ReactNode; 
  confirmText?: string; 
  confirmVariant?: 'danger' | 'primary'; 
} | null;

type LastActiveSessionInfo = { type: 'single' | 'group', sessionId: string, characterId?: string } | null;

interface AppState {
  // Persisted State
  characters: Character[];
  settings: Settings;
  worlds: World[];
  userPersona: Persona;
  conversations: Record<string, ChatSession[]>;
  groupConversations: Record<string, GroupChatSession>;
  activeCharacterId: string | null;
  activeSessionId: string | null;
  activeGroupSessionId: string | null;
  lastActiveSessionInfo: LastActiveSessionInfo;

  // Non-persisted (transient) State
  currentView: View;
  isLoading: boolean;
  error: string | null;
  isConfirmationModalOpen: boolean;
  confirmationAction: ConfirmationAction;
  isInitialized: boolean;
}

interface AppActions {
    initStore: () => void;
    
    // View & Modal Actions
    setCurrentView: (view: View) => void;
    requestConfirmation: (action: () => void, title: string, message: ReactNode, confirmText?: string, confirmVariant?: 'danger' | 'primary') => void;
    handleConfirm: () => void;
    handleCloseConfirmation: () => void;
    resetChatView: () => void;

    // Chat Actions
    sendMessage: (content: string) => Promise<void>;
    editMessage: (messageId: string, newContent: string) => Promise<void>;
    deleteMessage: (messageId: string) => void;
    regenerateResponse: () => Promise<void>;
    continueGeneration: () => Promise<void>;
    stopGeneration: () => void;

    // Session Management
    newSession: () => void;
    forkChat: (messageId: string) => void;
    startChat: (characterId: string) => void;
    selectSession: (characterId: string, sessionId: string) => void;
    deleteSession: (characterId: string, sessionId: string) => void;
    
    // Group Chat Actions
    sendGroupMessage: (content: string) => Promise<void>;
    editGroupMessage: (messageId: string, newContent: string) => Promise<void>;
    deleteGroupMessage: (messageId: string) => void;
    regenerateGroupResponse: () => Promise<void>;
    // FIX: Renamed duplicate `continueGeneration` to `continueGroupGeneration`.
    continueGroupGeneration: () => Promise<void>;
    
    // Group Session Management
    forkGroupChat: (messageId: string) => void;
    createGroupChat: (characterIds: string[], scenario: string) => void;
    selectGroupSession: (sessionId: string) => void;
    deleteGroupSession: (sessionId: string) => void;

    // Per-Session Settings
    setWorld: (worldId: string | null) => void;
    setTemperature: (temperature: number) => void;
    setThinkingEnabled: (enabled: boolean) => void;
    setContextSize: (contextSize: number) => void;
    setMaxOutputTokens: (maxOutputTokens: number) => void;
    setMemoryEnabled: (enabled: boolean) => void;

    // Character Management
    saveCharacter: (character: Character) => void;
    deleteCharacter: (id: string) => void;
    duplicateCharacter: (id: string) => void;
    importCharacters: (characters: Character[]) => void;
    generateCharacterProfile: (concept: string) => Promise<Partial<Character>>;

    // Persona Management
    savePersona: (persona: Persona) => void;

    // Global Settings
    saveSettings: (settings: Settings) => void;

    // World Management
    saveWorld: (world: World) => void;
    deleteWorld: (id: string) => void;
    importWorlds: (worlds: World[]) => void;
    
    // Debug
    getAppState: () => Record<string, unknown>;

    // Internal Actions for self-calls, not typically for component use
    updateActiveSessionSettings: (update: Partial<ChatSession & GroupChatSession>) => void;
    handleSummarization: (session: ChatSession | GroupChatSession, currentMessages: Message[]) => Promise<{ messages: Message[], summary: string | undefined }>;
    runChatCompletion: (character: Character, session: ChatSession, messages: Message[]) => Promise<void>;
    runGroupChatCompletion: (session: GroupChatSession, messages: Message[]) => Promise<void>;
}


// --- Chat Logic Helpers ---
let abortController: AbortController | null = null;
const RENDER_INTERVAL = 100;
const THINKING_TOKEN = '<|THINKING|>';
const MEMORY_TRIGGER_THRESHOLD = 0.75;
const MEMORY_SLICE_PERCENT = 0.5;
const estimateTokens = (text: string): number => Math.ceil((text || '').length / 4);
const extractErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.name === 'AbortError') {
        return 'Generation stopped by user.';
    }

    // 1. If it's an object, start probing for messages
    if (typeof error === 'object' && error !== null) {
        // Look for nested message properties, common in API error responses
        const potentialMessage =
            (error as any).response?.data?.error?.message ||
            (error as any).response?.data?.message ||
            (error as any).error?.message ||
            (error as any).message;

        if (typeof potentialMessage === 'string' && potentialMessage.trim()) {
            return potentialMessage;
        }

        // Try to stringify if all else fails, to get some info
        try {
            const stringified = JSON.stringify(error);
            if (stringified !== '{}') {
                return `An unknown error occurred: ${stringified}`;
            }
        } catch {
            return 'An un-stringifiable error object was received.';
        }
    }

    // 2. Handle standard Error instances (if not already handled as object with message)
    if (error instanceof Error) {
        return error.message;
    }
    
    // 3. Last resort fallback
    const stringified = String(error);
    if (stringified === '[object Object]') {
        return 'An unknown object-based error occurred. Check the console for details.';
    }

    return stringified;
};


// --- Store Definition ---

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      // --- Initial State ---
      characters: [DEFAULT_CHARACTER],
      settings: DEFAULT_SETTINGS,
      worlds: [],
      userPersona: DEFAULT_USER_PERSONA,
      conversations: {},
      groupConversations: {},
      activeCharacterId: null,
      activeSessionId: null,
      activeGroupSessionId: null,
      lastActiveSessionInfo: null,
      currentView: 'CHARACTER_SELECTION',
      isLoading: false,
      error: null,
      isConfirmationModalOpen: false,
      confirmationAction: null,
      isInitialized: false,

      // --- Actions ---

      initStore: () => {
        if (get().isInitialized) return;
        logger.log('Store initialized');
        set(state => {
            let characters = state.characters;
            const hasGM = characters.some(c => c.id === GM_CHARACTER_ID);

            if (hasGM) {
                characters = characters.map(c => c.id === GM_CHARACTER_ID ? GM_CHARACTER : c);
            } else {
                characters = [GM_CHARACTER, ...characters];
            }
            
            // Add default character if the user only has the GM character.
            const customCharacters = characters.filter(c => !c.isImmutable);
            if (customCharacters.length === 0) {
                const hasDefault = characters.some(c => c.id === DEFAULT_CHARACTER.id);
                if (!hasDefault) {
                    characters.push(DEFAULT_CHARACTER);
                }
            }

            return { isInitialized: true, characters };
        });
      },
      
      setCurrentView: (view) => set({ currentView: view }),

      resetChatView: () => {
        set({
            currentView: 'CHARACTER_SELECTION',
            activeCharacterId: null,
            activeSessionId: null,
            activeGroupSessionId: null,
        });
      },

      requestConfirmation: (action, title, message, confirmText = 'Confirm', confirmVariant = 'primary') => {
        logger.uiEvent('Confirmation requested', { title });
        set({
          isConfirmationModalOpen: true,
          confirmationAction: { action, title, message, confirmText, confirmVariant },
        });
      },

      handleConfirm: () => {
        const { confirmationAction } = get();
        if (confirmationAction) {
          logger.uiEvent('Confirmation accepted', { title: confirmationAction.title });
          confirmationAction.action();
        }
        set({ isConfirmationModalOpen: false, confirmationAction: null });
      },

      handleCloseConfirmation: () => {
        const { confirmationAction } = get();
        if (confirmationAction) logger.uiEvent('Confirmation dismissed', { title: confirmationAction.title });
        set({ isConfirmationModalOpen: false, confirmationAction: null });
      },

      stopGeneration: () => {
        if (abortController) {
          logger.uiEvent('Stop generation requested by user');
          abortController.abort();
          abortController = null;
        }
        if (get().isLoading) set({ isLoading: false });
      },

      // --- Character & Persona ---
      saveCharacter: (character) => set(state => ({
        characters: state.characters.find(c => c.id === character.id)
          ? state.characters.map(c => c.id === character.id ? character : c)
          : [...state.characters, character]
      })),

      deleteCharacter: (id) => {
        const { characters, requestConfirmation } = get();
        const charToDelete = characters.find(c => c.id === id);
        if (!charToDelete || charToDelete.isImmutable) return;
        requestConfirmation(() => {
          // FIX: Defined `isDeletingActive` and moved logic into `set` for atomic updates.
          set(state => {
            const isDeletingActive = state.activeCharacterId === id;
            
            const newConversations = { ...state.conversations };
            delete newConversations[id];
            
            const newGroupConversations = { ...state.groupConversations };
            Object.keys(newGroupConversations).forEach(sid => {
                const session = newGroupConversations[sid];
                if (session.characterIds.includes(id)) {
                    if (session.characterIds.length <= 2) delete newGroupConversations[sid];
                    else newGroupConversations[sid] = { ...session, characterIds: session.characterIds.filter(cid => cid !== id) };
                }
            });

            return {
              characters: state.characters.filter(c => c.id !== id),
              conversations: newConversations,
              groupConversations: newGroupConversations,
              activeCharacterId: isDeletingActive ? null : state.activeCharacterId,
              activeSessionId: isDeletingActive ? null : state.activeSessionId,
              currentView: isDeletingActive ? 'CHARACTER_SELECTION' : state.currentView,
              lastActiveSessionInfo: state.lastActiveSessionInfo?.characterId === id ? null : state.lastActiveSessionInfo,
            };
          });
        }, 'Delete Character', `Are you sure you want to delete "${charToDelete.name}"? All associated single and group chat histories will also be permanently deleted.`, 'Delete Character', 'danger');
      },

      duplicateCharacter: (id) => {
        const char = get().characters.find(c => c.id === id);
        if (!char) return;
        const newChar = { ...char, id: crypto.randomUUID(), name: `${char.name} (Copy)`, isImmutable: false };
        set(state => ({ characters: [...state.characters, newChar] }));
      },

      importCharacters: (imported) => {
        const existingIds = new Set(get().characters.map(c => c.id));
        const newChars = imported.filter(ic => !existingIds.has(ic.id));
        set(state => ({ characters: [...state.characters, ...newChars] }));
        alert(`${newChars.length} new character(s) imported!`);
      },
      
      savePersona: (persona) => set({ userPersona: persona }),
      
      // --- Settings & Worlds ---
      saveSettings: (newSettings) => set({ settings: newSettings }),
      
      saveWorld: (world) => set(state => ({
        worlds: state.worlds.find(w => w.id === world.id)
          ? state.worlds.map(w => w.id === world.id ? world : w)
          : [...state.worlds, world]
      })),

      deleteWorld: (id) => {
        const { worlds, requestConfirmation } = get();
        const worldToDelete = worlds.find(w => w.id === id);
        if (!worldToDelete) return;
        requestConfirmation(() => {
          set(state => {
            const newConversations = { ...state.conversations };
            Object.keys(newConversations).forEach(charId => {
              newConversations[charId] = newConversations[charId].map(s => s.worldId === id ? { ...s, worldId: null } : s);
            });
            const newGroupConversations = { ...state.groupConversations };
            Object.keys(newGroupConversations).forEach(sid => {
              if (newGroupConversations[sid].worldId === id) newGroupConversations[sid] = { ...newGroupConversations[sid], worldId: null };
            });
            return {
              worlds: state.worlds.filter(w => w.id !== id),
              conversations: newConversations,
              groupConversations: newGroupConversations,
              settings: state.settings.worldId === id ? { ...state.settings, worldId: null } : state.settings,
            };
          });
        }, 'Delete World', `Are you sure you want to delete the world "${worldToDelete.name}"? This will unlink it from any chats, but will not delete the chats themselves.`, 'Delete World', 'danger');
      },
      
      importWorlds: (imported) => {
        const existingIds = new Set(get().worlds.map(w => w.id));
        const newWorlds = imported.filter(iw => 
            iw && typeof iw === 'object' && 'id' in iw && 'name' in iw && 'entries' in iw && !existingIds.has(iw.id)
        );
        set(state => ({ worlds: [...state.worlds, ...newWorlds] }));
        alert(`${newWorlds.length} new world(s) imported successfully!`);
      },
      
      // --- Session Management ---
      startChat: (id) => {
        const { characters, conversations, settings } = get();
        const character = characters.find(c => c.id === id);
        if (!character) return;
        const existingSessions = conversations[id];
        if (existingSessions?.length) {
          // FIX: Changed .at(-1) to [arr.length - 1] for better compatibility.
          const mostRecent = existingSessions.reduce((a, b) => ((b.messages[b.messages.length - 1]?.timestamp ?? 0) > (a.messages[a.messages.length - 1]?.timestamp ?? 0) ? b : a));
          get().selectSession(id, mostRecent.id);
          return;
        }
        const newSessionData: ChatSession = { id: crypto.randomUUID(), title: `New Chat - ${new Date().toLocaleString()}`, messages: [], worldId: settings.worldId, temperature: settings.temperature, thinkingEnabled: settings.thinkingEnabled, contextSize: settings.contextSize, maxOutputTokens: settings.maxOutputTokens, memoryEnabled: false };
        if (character.greeting) newSessionData.messages.push({ id: crypto.randomUUID(), role: 'assistant', content: character.greeting, timestamp: Date.now() });
        set(state => ({
          conversations: { ...state.conversations, [id]: [...(state.conversations[id] || []), newSessionData] },
          activeCharacterId: id,
          activeSessionId: newSessionData.id,
          lastActiveSessionInfo: { type: 'single', characterId: id, sessionId: newSessionData.id },
          currentView: 'CHAT'
        }));
      },

      selectSession: (characterId, sessionId) => set({
        activeCharacterId: characterId,
        activeSessionId: sessionId,
        lastActiveSessionInfo: { type: 'single', characterId, sessionId },
        currentView: 'CHAT'
      }),

      newSession: () => {
        const { activeCharacterId, characters, settings } = get();
        if (!activeCharacterId) return;
        const character = characters.find(c => c.id === activeCharacterId);
        if (!character) return;
        const newSessionData: ChatSession = { id: crypto.randomUUID(), title: `New Chat - ${new Date().toLocaleString()}`, messages: [], worldId: settings.worldId, temperature: settings.temperature, thinkingEnabled: settings.thinkingEnabled, contextSize: settings.contextSize, maxOutputTokens: settings.maxOutputTokens, memoryEnabled: false };
        if (character.greeting) newSessionData.messages.push({ id: crypto.randomUUID(), role: 'assistant', content: character.greeting, timestamp: Date.now() });
        set(state => ({
            conversations: { ...state.conversations, [activeCharacterId]: [...(state.conversations[activeCharacterId] || []), newSessionData] },
            activeSessionId: newSessionData.id,
            lastActiveSessionInfo: { type: 'single', characterId: activeCharacterId, sessionId: newSessionData.id }
        }));
      },

      forkChat: (messageId) => {
        const { characters, activeCharacterId, conversations, activeSessionId } = get();
        const character = characters.find(c => c.id === activeCharacterId);
        const session = conversations[activeCharacterId || '']?.find(s => s.id === activeSessionId);
        if (!character || !session) return;
        const msgIndex = session.messages.findIndex(m => m.id === messageId);
        if (msgIndex === -1) return;
        const newSessionData: ChatSession = { ...session, id: crypto.randomUUID(), title: `${session.title} (Fork)`, messages: session.messages.slice(0, msgIndex + 1) };
        set(state => ({
            conversations: { ...state.conversations, [character.id]: [...(state.conversations[character.id] || []), newSessionData] },
            activeSessionId: newSessionData.id,
            lastActiveSessionInfo: { type: 'single', characterId: character.id, sessionId: newSessionData.id },
            currentView: 'CHAT'
        }));
      },

      deleteSession: (characterId, sessionId) => {
        const { characters, conversations, requestConfirmation } = get();
        const char = characters.find(c => c.id === characterId);
        const session = conversations[characterId]?.find(s => s.id === sessionId);
        if (!char || !session) return;
        requestConfirmation(() => set(state => {
            const newConvos = { ...state.conversations };
            newConvos[characterId] = (newConvos[characterId] || []).filter(s => s.id !== sessionId);
            if (newConvos[characterId].length === 0) delete newConvos[characterId];
            return { conversations: newConvos };
        }), 'Delete Chat History', `Are you sure you want to delete the chat "${session.title}" with "${char.name}"?`, 'Delete', 'danger');
      },

      // --- Group Session ---
      createGroupChat: (characterIds, scenario) => {
          const { characters, settings } = get();
          if (characterIds.length < 2 || !scenario.trim()) return;
          const participating = characters.filter(c => characterIds.includes(c.id));
          const title = participating.map(c => c.name).slice(0, 3).join(', ') + (participating.length > 3 ? '...' : '');
          const newSessionData: GroupChatSession = { id: crypto.randomUUID(), title, characterIds, scenario, messages: [], worldId: settings.worldId, temperature: settings.temperature, thinkingEnabled: settings.thinkingEnabled, contextSize: settings.contextSize, maxOutputTokens: settings.maxOutputTokens, memoryEnabled: false };
          set(state => ({
              groupConversations: { ...state.groupConversations, [newSessionData.id]: newSessionData },
              activeGroupSessionId: newSessionData.id,
              lastActiveSessionInfo: { type: 'group', sessionId: newSessionData.id },
              currentView: 'GROUP_CHAT'
          }));
      },
      
      selectGroupSession: (sessionId) => set({
        activeGroupSessionId: sessionId,
        lastActiveSessionInfo: { type: 'group', sessionId },
        currentView: 'GROUP_CHAT'
      }),

      forkGroupChat: (messageId) => {
        const { groupConversations, activeGroupSessionId } = get();
        const session = groupConversations[activeGroupSessionId || ''];
        if (!session) return;
        const msgIndex = session.messages.findIndex(m => m.id === messageId);
        if (msgIndex === -1) return;
        const newSessionData: GroupChatSession = { ...session, id: crypto.randomUUID(), title: `${session.title} (Fork)`, messages: session.messages.slice(0, msgIndex + 1) };
        set(state => ({
            groupConversations: { ...state.groupConversations, [newSessionData.id]: newSessionData },
            activeGroupSessionId: newSessionData.id,
            lastActiveSessionInfo: { type: 'group', sessionId: newSessionData.id },
            currentView: 'GROUP_CHAT'
        }));
      },

      deleteGroupSession: (sessionId) => {
        const session = get().groupConversations[sessionId];
        if (!session) return;
        get().requestConfirmation(() => set(state => {
          const newState = { ...state.groupConversations };
          delete newState[sessionId];
          return { groupConversations: newState };
        }), 'Delete Group Chat', `Are you sure you want to delete the group chat "${session.title}"?`, 'Delete', 'danger');
      },

      // --- Per-Session Settings ---
      setWorld: (worldId) => get().updateActiveSessionSettings({ worldId }),
      setTemperature: (temperature) => get().updateActiveSessionSettings({ temperature }),
      setThinkingEnabled: (thinkingEnabled) => get().updateActiveSessionSettings({ thinkingEnabled }),
      setContextSize: (contextSize) => get().updateActiveSessionSettings({ contextSize }),
      setMaxOutputTokens: (maxOutputTokens) => get().updateActiveSessionSettings({ maxOutputTokens }),
      setMemoryEnabled: (memoryEnabled) => get().updateActiveSessionSettings({ memoryEnabled }),

      updateActiveSessionSettings: (update) => {
        const { activeCharacterId, activeSessionId, activeGroupSessionId } = get();
        if (activeCharacterId && activeSessionId) {
            set(state => ({ conversations: { ...state.conversations, [activeCharacterId]: (state.conversations[activeCharacterId] || []).map(s => s.id === activeSessionId ? { ...s, ...update } : s) } }));
        } else if (activeGroupSessionId) {
            set(state => {
              const session = state.groupConversations[activeGroupSessionId];
              if (!session) return state;
              return { groupConversations: { ...state.groupConversations, [activeGroupSessionId]: { ...session, ...update } } };
            });
        }
      },

      // --- Chat Implementation ---
      sendMessage: async (content) => {
        const { characters, activeCharacterId, conversations, activeSessionId } = get();
        const char = characters.find(c => c.id === activeCharacterId);
        const session = conversations[activeCharacterId || '']?.find(s => s.id === activeSessionId);
        if (!char || !session) return;
        logger.uiEvent('Sending message', { len: content.length });
        const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content, timestamp: Date.now() };
        await get().runChatCompletion(char, session, [...session.messages, userMessage]);
      },

      editMessage: async (messageId, newContent) => {
        const { characters, activeCharacterId, conversations, activeSessionId } = get();
        const char = characters.find(c => c.id === activeCharacterId);
        const session = conversations[activeCharacterId || '']?.find(s => s.id === activeSessionId);
        if (!char || !session) return;
        const msgIndex = session.messages.findIndex(m => m.id === messageId);
        if (msgIndex === -1) return;
        const msgToEdit = session.messages[msgIndex];
        if (msgToEdit.role === 'user') {
            const updatedMessages = session.messages.slice(0, msgIndex).concat({ ...msgToEdit, content: newContent, timestamp: Date.now() });
            await get().runChatCompletion(char, session, updatedMessages);
        } else {
            set(state => ({ conversations: { ...state.conversations, [char.id]: (state.conversations[char.id] || []).map(s => s.id !== session.id ? s : { ...s, messages: s.messages.map(m => m.id === messageId ? { ...m, content: newContent } : m) }) }}));
        }
      },
      
      deleteMessage: (messageId) => {
        const { activeCharacterId, conversations, activeSessionId, requestConfirmation } = get();
        if (!activeCharacterId || !activeSessionId) return;
        const session = conversations[activeCharacterId]?.find(s => s.id === activeSessionId);
        const msg = session?.messages.find(m => m.id === messageId);
        if (!msg) return;
        requestConfirmation(() => {
          set(state => ({ conversations: { ...state.conversations, [activeCharacterId]: (state.conversations[activeCharacterId] || []).map(s => s.id !== activeSessionId ? s : { ...s, messages: s.messages.filter(m => m.id !== messageId)})}}));
        }, 'Delete Message', `Permanently delete this message?\n\n"${msg.content}"`, 'Delete', 'danger');
      },

      regenerateResponse: async () => {
        const { characters, activeCharacterId, conversations, activeSessionId, isLoading } = get();
        const char = characters.find(c => c.id === activeCharacterId);
        const session = conversations[activeCharacterId || '']?.find(s => s.id === activeSessionId);
        if (!char || !session || isLoading) return;
        const messagesToResend = session.messages.slice(0, -1);
        if (messagesToResend.length === 0 || session.messages[session.messages.length - 1]?.role !== 'assistant') return;
        await get().runChatCompletion(char, session, messagesToResend);
      },
      
      continueGeneration: async () => {
        const { characters, activeCharacterId, conversations, activeSessionId, isLoading } = get();
        const char = characters.find(c => c.id === activeCharacterId);
        const session = conversations[activeCharacterId || '']?.find(s => s.id === activeSessionId);
        if (!char || !session || session.messages.length === 0 || isLoading) return;
        const lastMessage = session.messages[session.messages.length - 1];
        if (lastMessage?.role !== 'assistant') return;
        const messagesToResend = session.messages.slice(0, -1);
        await get().runChatCompletion(char, session, messagesToResend);
      },

      sendGroupMessage: async (content) => {
        const { groupConversations, activeGroupSessionId } = get();
        const session = groupConversations[activeGroupSessionId || ''];
        if (!session) return;
        const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content, timestamp: Date.now() };
        await get().runGroupChatCompletion(session, [...session.messages, userMessage]);
      },
      
      editGroupMessage: async (messageId, newContent) => {
        const { groupConversations, activeGroupSessionId } = get();
        const session = groupConversations[activeGroupSessionId || ''];
        if (!session) return;
        const msgIndex = session.messages.findIndex(m => m.id === messageId);
        if (msgIndex === -1) return;
        if (session.messages[msgIndex].role === 'user') {
          const updatedMessages = session.messages.slice(0, msgIndex).concat({ ...session.messages[msgIndex], content: newContent, timestamp: Date.now() });
          await get().runGroupChatCompletion(session, updatedMessages);
        } else {
          set(state => ({ groupConversations: { ...state.groupConversations, [session.id]: { ...session, messages: session.messages.map(m => m.id === messageId ? { ...m, content: newContent } : m) } } }));
        }
      },

      deleteGroupMessage: (messageId) => {
        const { groupConversations, activeGroupSessionId, requestConfirmation } = get();
        const session = groupConversations[activeGroupSessionId || ''];
        const msg = session?.messages.find(m => m.id === messageId);
        if (!session || !msg) return;
        requestConfirmation(() => {
          set(state => ({ groupConversations: { ...state.groupConversations, [session.id]: { ...session, messages: session.messages.filter(m => m.id !== messageId) } } }));
        }, 'Delete Message', `Permanently delete this message?\n\n"${msg.content}"`, 'Delete', 'danger');
      },

      regenerateGroupResponse: async () => {
        const { groupConversations, activeGroupSessionId, isLoading } = get();
        const session = groupConversations[activeGroupSessionId || ''];
        if (!session || isLoading) return;
        const messagesToResend = session.messages.slice(0, -1);
        if (messagesToResend.length === 0 || session.messages[session.messages.length - 1]?.role !== 'assistant') return;
        await get().runGroupChatCompletion(session, messagesToResend);
      },

      continueGroupGeneration: async () => {
        const { groupConversations, activeGroupSessionId, isLoading } = get();
        const session = groupConversations[activeGroupSessionId || ''];
        if (!session || session.messages.length === 0 || isLoading) return;
        const lastMessage = session.messages[session.messages.length - 1];
        if (lastMessage?.role !== 'assistant') return;
        const messagesToResend = session.messages.slice(0, -1);
        await get().runGroupChatCompletion(session, messagesToResend);
      },

      // --- Core Chat Logic ---
      handleSummarization: async (session, currentMessages) => {
        const { settings } = get();
        const contextSize = session.contextSize ?? settings.contextSize;
        if (!(session.memoryEnabled && contextSize > 0)) return { messages: currentMessages, summary: session.memorySummary };
        const totalTokens = estimateTokens(JSON.stringify(currentMessages));
        if (totalTokens < contextSize * MEMORY_TRIGGER_THRESHOLD) return { messages: currentMessages, summary: session.memorySummary };
        logger.log('Memory threshold reached', { totalTokens, contextSize });
        const sliceIndex = Math.floor(currentMessages.length * MEMORY_SLICE_PERCENT);
        const messagesToSummarize = currentMessages.slice(0, sliceIndex);
        const remainingMessages = currentMessages.slice(sliceIndex);
        try {
            const { provider, apiKeys, models } = settings;
            const model = models?.[provider] || '';
            const apiKey = provider === LLMProvider.GEMINI ? (process.env.API_KEY || '') : apiKeys[provider];

            if (!apiKey || !model) {
                const errorMsg = !apiKey ? 'API key is missing.' : 'Model name is missing.';
                logger.error(`Auto-summarization failed: ${errorMsg}`);
                set({ error: `Auto-summarization failed: ${errorMsg} Please check settings.` });
                return { messages: currentMessages, summary: session.memorySummary };
            }
            const newSummary = await summarizeMessages({ provider, apiKey, model, messages: messagesToSummarize });
            const updatedSummary = [session.memorySummary, newSummary].filter(Boolean).join('\n\n');
            const sysMsg: Message = { id: crypto.randomUUID(), role: 'system', content: '[System: Conversation history summarized.]', timestamp: Date.now() };
            return { messages: [sysMsg, ...remainingMessages], summary: updatedSummary };
        } catch (err) {
            logger.error('Auto-summarization failed.', { error: err });
            set({ error: "Auto-summarization failed. Check API key and model settings." });
            return { messages: currentMessages, summary: session.memorySummary };
        }
      },

      runChatCompletion: async (character, session, messages) => {
        set({ isLoading: true, error: null });
        const { messages: processedMessages, summary: updatedSummary } = await get().handleSummarization(session, messages);
        set(state => ({ conversations: { ...state.conversations, [character.id]: (state.conversations[character.id] || []).map(s => s.id === session.id ? { ...s, messages: processedMessages, memorySummary: updatedSummary } : s) } }));

        abortController = new AbortController();
        const aiMsgId = crypto.randomUUID();
        const aiMsgShell: Message = { id: aiMsgId, role: 'assistant', content: '', timestamp: Date.now() };
        set(state => ({ conversations: { ...state.conversations, [character.id]: (state.conversations[character.id] || []).map(s => s.id === session.id ? { ...s, messages: [...processedMessages, aiMsgShell] } : s) } }));

        let fullResponse = '', fullThinking = '', parsingThinking = false;
        try {
            const { settings, userPersona, worlds } = get();
            const { provider, apiKeys, models } = settings;
            const apiKey = apiKeys[provider]; // Store passes the key from settings. The service layer will ignore it for Gemini.
            const model = models?.[provider] || '';
            const prefill = settings.responsePrefill;
            
            if (provider !== LLMProvider.GEMINI && !apiKey) throw new Error(`API key for ${provider} is not set. Please configure it in Settings.`);
            if (!model) throw new Error(`Model for ${provider} is not set. Please configure it in Settings.`);

            const stream = getChatCompletionStream({
                provider, apiKey, model, messages: processedMessages,
                characterPersona: character.persona, userPersona, globalSystemPrompt: settings.systemPrompt,
                world: worlds.find(w => w.id === session.worldId), temperature: session.temperature ?? settings.temperature,
                prefill, signal: abortController.signal, thinkingEnabled: session.thinkingEnabled ?? settings.thinkingEnabled,
                contextSize: session.contextSize ?? settings.contextSize, maxOutputTokens: session.maxOutputTokens ?? settings.maxOutputTokens, memorySummary: updatedSummary,
            });

            let lastRenderTime = Date.now();
            for await (const chunk of stream) {
                if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                let currentChunk = chunk;
                if (!parsingThinking && currentChunk.includes(THINKING_TOKEN)) {
                    const parts = currentChunk.split(THINKING_TOKEN);
                    fullResponse += parts[0]; parsingThinking = true; fullThinking += parts.slice(1).join(THINKING_TOKEN);
                } else if (parsingThinking) fullThinking += currentChunk;
                else fullResponse += currentChunk;

                if (Date.now() - lastRenderTime > RENDER_INTERVAL) {
                    let contentToRender = fullResponse;
                    if (prefill && contentToRender.trimStart().startsWith(prefill)) {
                        let afterPrefill = contentToRender.substring(contentToRender.indexOf(prefill) + prefill.length);
                        contentToRender = afterPrefill.replace(/^\s*---\s*/, '');
                    }
                    set(state => ({ conversations: { ...state.conversations, [character.id]: (state.conversations[character.id] || []).map(s => s.id !== session.id ? s : { ...s, messages: s.messages.map(m => m.id === aiMsgId ? { ...m, content: contentToRender.trimStart() } : m) }) }}));
                    lastRenderTime = Date.now();
                }
            }
        } catch (err) {
            const msg = extractErrorMessage(err);
            if (msg !== 'Generation stopped by user.') {
                set({ error: msg });
                fullResponse = `Error: ${msg}`;
                logger.error('Chat completion failed', { error: err, friendlyMessage: msg });
            }
        } finally {
            const prefill = get().settings.responsePrefill;
            let finalContent = fullResponse.trim();
            if (prefill && finalContent.startsWith(prefill)) {
              let afterPrefill = finalContent.substring(prefill.length);
              finalContent = afterPrefill.replace(/^\s*---\s*/, '').trimStart();
            } else {
                const separator = '\n---\n';
                const separatorIndex = finalContent.indexOf(separator);
                if (separatorIndex > -1 && separatorIndex < 400) { 
                    finalContent = finalContent.substring(separatorIndex + separator.length).trimStart();
                }
            }
            set(state => ({ isLoading: false, conversations: { ...state.conversations, [character.id]: (state.conversations[character.id] || []).map(s => s.id !== session.id ? s : { ...s, messages: s.messages.map(m => m.id === aiMsgId ? { ...m, content: finalContent || '(Empty response)', thinking: fullThinking.trim() || undefined } : m) }) }}));
            if (abortController && !abortController.signal.aborted) abortController = null;
        }
      },

      runGroupChatCompletion: async (session, messages) => {
        set({ isLoading: true, error: null });
        const { messages: processedMessages, summary: updatedSummary } = await get().handleSummarization(session, messages);
        set(state => ({ groupConversations: { ...state.groupConversations, [session.id]: { ...session, messages: processedMessages, memorySummary: updatedSummary } } }));

        abortController = new AbortController();
        const aiMsgId = crypto.randomUUID();
        const aiMsgShell: Message = { id: aiMsgId, role: 'assistant', content: '', timestamp: Date.now() };
        set(state => ({ groupConversations: { ...state.groupConversations, [session.id]: { ...session, messages: [...processedMessages, aiMsgShell] } } }));
        
        let fullResponse = '', fullThinking = '', parsingThinking = false;
        try {
            const { settings, userPersona, worlds, characters } = get();
            const { provider, apiKeys, models } = settings;
            const apiKey = apiKeys[provider]; // Store passes the key from settings. The service layer will ignore it for Gemini.
            const model = models?.[provider] || '';
            const prefill = settings.responsePrefill;

            if (provider !== LLMProvider.GEMINI && !apiKey) throw new Error(`API key for ${provider} is not set. Please configure it in Settings.`);
            if (!model) throw new Error(`Model for ${provider} is not set. Please configure it in Settings.`);

            const sessionChars = characters.filter(c => session.characterIds.includes(c.id));
            const charPrompt = `SCENARIO: ${session.scenario}\n\nCHARACTERS: ${sessionChars.map(c=>`[${c.name}]`).join(', ')}\n\nPERSONAS:\n${sessionChars.map(c => `[${c.name}]:\n${c.persona}`).join('\n\n')}\n\nINSTRUCTIONS: Roleplay as the character who should speak next. Prefix your response with the speaking character's name in brackets, like [Character Name]: ...`;

            const stream = getChatCompletionStream({
                provider, apiKey, model, messages: processedMessages, characterPersona: charPrompt, userPersona,
                globalSystemPrompt: settings.systemPrompt, world: worlds.find(w => w.id === session.worldId), temperature: session.temperature ?? settings.temperature,
                prefill, signal: abortController.signal, thinkingEnabled: session.thinkingEnabled ?? settings.thinkingEnabled,
                contextSize: session.contextSize ?? settings.contextSize, maxOutputTokens: session.maxOutputTokens ?? settings.maxOutputTokens, memorySummary: updatedSummary,
            });

            let lastRenderTime = Date.now();
            for await (const chunk of stream) {
                if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                if (!parsingThinking && chunk.includes(THINKING_TOKEN)) {
                    const parts = chunk.split(THINKING_TOKEN);
                    fullResponse += parts[0]; parsingThinking = true; fullThinking += parts.slice(1).join(THINKING_TOKEN);
                } else if (parsingThinking) fullThinking += chunk;
                else fullResponse += chunk;
                if (Date.now() - lastRenderTime > RENDER_INTERVAL) {
                    let contentToRender = fullResponse;
                     if (prefill && contentToRender.trimStart().startsWith(prefill)) {
                        let afterPrefill = contentToRender.substring(contentToRender.indexOf(prefill) + prefill.length);
                        contentToRender = afterPrefill.replace(/^\s*---\s*/, '');
                    }
                    set(state => ({ groupConversations: { ...state.groupConversations, [session.id]: { ...session, messages: session.messages.map(m => m.id === aiMsgId ? { ...m, content: contentToRender.trimStart() } : m) } } }));
                    lastRenderTime = Date.now();
                }
            }
        } catch (err) {
            const msg = extractErrorMessage(err);
            if (msg !== 'Generation stopped by user.') {
                set({ error: msg });
                fullResponse = `Error: ${msg}`;
                logger.error('Group chat completion failed', { error: err, friendlyMessage: msg });
            }
        } finally {
            const prefill = get().settings.responsePrefill;
            let finalResponse = fullResponse.trim();
            if (prefill && finalResponse.startsWith(prefill)) {
                let afterPrefill = finalResponse.substring(prefill.length);
                finalResponse = afterPrefill.replace(/^\s*---\s*/, '').trimStart();
            } else {
                const separator = '\n---\n';
                const separatorIndex = finalResponse.indexOf(separator);
                if (separatorIndex > -1 && separatorIndex < 400) { 
                    finalResponse = finalResponse.substring(separatorIndex + separator.length).trimStart();
                }
            }
            const match = finalResponse.match(/^\[(.*?)\]:\s*(.*)$/s);
            const charId = match ? get().characters.find(c => session.characterIds.includes(c.id) && c.name === match[1])?.id : undefined;
            set(state => ({ isLoading: false, groupConversations: { ...state.groupConversations, [session.id]: { ...session, messages: session.messages.map(m => m.id === aiMsgId ? { ...m, content: finalResponse || '(Empty Response)', characterId: charId, thinking: fullThinking.trim() || undefined } : m) } } }));
            if (abortController && !abortController.signal.aborted) abortController = null;
        }
      },

      generateCharacterProfile: async (concept) => {
        const { settings } = get();
        const { provider, apiKeys, models } = settings;
        const model = models?.[provider] || '';
        const apiKey = provider === LLMProvider.GEMINI ? (process.env.API_KEY || '') : apiKeys[provider];
        
        if (!apiKey) throw new Error(`API key for ${provider} is not set. Please configure it in Settings.`);
        if (!model) throw new Error(`Model for ${provider} is not set. Please configure it in Settings.`);

        const profile = await generateProfile({ provider, apiKey, model, concept });
        return { name: profile.name, greeting: profile.greeting, description: profile.description, persona: profile.persona };
      },

      getAppState: () => {
        const state = get();
        const stateToLog: Partial<AppState> = { ...state };
        // Exclude functions and non-serializable data for cleaner logging
        const functions = Object.entries(stateToLog).filter(([_, value]) => typeof value === 'function').map(([key]) => key);
        functions.forEach(key => delete stateToLog[key as keyof AppState]);
        return stateToLog;
      },
    }),
    {
      name: 'roleplay-nexus-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        characters: state.characters,
        settings: state.settings,
        worlds: state.worlds,
        userPersona: state.userPersona,
        conversations: state.conversations,
        groupConversations: state.groupConversations,
        activeCharacterId: state.activeCharacterId,
        activeSessionId: state.activeSessionId,
        activeGroupSessionId: state.activeGroupSessionId,
        lastActiveSessionInfo: state.lastActiveSessionInfo,
      }),
    }
  )
);