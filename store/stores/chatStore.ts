import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Character, Message, ChatSession, GroupChatSession, LLMProvider, GroupTurnAction } from '../../types';
import { useUIStore } from './uiStore';
import { useSettingsStore } from './settingsStore';
import { useWorldStore } from './worldStore';
import { useCharacterStore } from './characterStore';
import { getChatCompletionStream, getGroupChatCompletion, summarizeMessages } from '../../services/llmService';
import { logger } from '../../services/logger';

// --- Types & Interfaces ---
export type Session = Omit<ChatSession, 'messages'> & { messageIds: string[] };
export type GroupSession = Omit<GroupChatSession, 'messages'> & { messageIds: string[] };

export interface ChatState {
  sessions: Record<string, Session>;
  groupSessions: Record<string, GroupSession>;
  messages: Record<string, Message>;
  characterSessions: Record<string, string[]>; // characterId -> sessionId[]
}

export interface ChatActions {
  sendMessage: (content: string) => Promise<void>;
  editMessage: (sessionId: string, messageId: string, newContent: string) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
  regenerateResponse: (sessionId: string) => Promise<void>;
  continueGeneration: (sessionId: string) => Promise<void>;
  newSession: (characterId: string) => string;
  forkChat: (sessionId: string, messageId: string) => string;
  deleteSession: (characterId: string, sessionId: string) => void;
  sendGroupMessage: (content: string) => Promise<void>;
  editGroupMessage: (sessionId: string, messageId: string, newContent: string) => void;
  deleteGroupMessage: (sessionId: string, messageId: string) => void;
  regenerateGroupResponse: (sessionId: string) => Promise<void>;
  continueGroupGeneration: (sessionId: string) => Promise<void>;
  forkGroupChat: (sessionId: string, messageId: string) => string;
  createGroupChat: (characterIds: string[], scenario: string) => string;
  deleteGroupSession: (sessionId: string) => void;
  deleteChatsForCharacter: (characterId: string) => void;
  unlinkWorldFromAllSessions: (worldId: string) => void;
  setSessionWorld: (sessionId: string, worldId: string | null, isGroup?: boolean) => void;
  setSessionTemperature: (sessionId: string, temperature: number, isGroup?: boolean) => void;
  setSessionContextSize: (sessionId: string, contextSize: number, isGroup?: boolean) => void;
  setSessionMaxOutputTokens: (sessionId: string, maxOutputTokens: number, isGroup?: boolean) => void;
  setSessionMemoryEnabled: (sessionId: string, enabled: boolean, isGroup?: boolean) => void;
}

export type ChatStore = ChatState & ChatActions;

// --- Internal Helpers ---
const MEMORY_TRIGGER_THRESHOLD = 0.75;
const MEMORY_SLICE_PERCENT = 0.5;
const RENDER_INTERVAL = 100; // ms
const estimateTokens = (text: string): number => Math.ceil((text || '').length / 4);
const extractErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.name === 'AbortError') return 'Generation stopped by user.';
    const status = (error as any).status;
    if (status) {
        if (status === 401 || status === 403) return `Authentication error (Code: ${status}). Please check your API key.`;
        if (status === 429) return `Rate limit exceeded (Code: ${status}). Please wait and try again.`;
        if (status >= 500) return `Server error (Code: ${status}). The service may be temporarily unavailable.`;
    }
    if (typeof error === 'object' && error !== null) {
      const msg = (error as any).response?.data?.error?.message || (error as any).response?.data?.message || (error as any).error?.message || (error as any).message;
      if (typeof msg === 'string' && msg.trim()) return msg;
    }
    if (error instanceof Error) return error.message;
    return "An unknown error occurred.";
  };

// --- Store Definition ---
export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => {
      const handleSummarization = async (
        session: Session | GroupSession,
        currentMessages: Message[],
      ): Promise<{ messages: Message[]; summary: string | undefined }> => {
        const { settings } = useSettingsStore.getState();
        const contextSize = session.contextSize ?? settings.contextSize;
        if (!session.memoryEnabled || !contextSize || contextSize <= 0) return { messages: currentMessages, summary: session.memorySummary };
        
        const totalTokens = estimateTokens(JSON.stringify(currentMessages));
        if (totalTokens < contextSize * MEMORY_TRIGGER_THRESHOLD) return { messages: currentMessages, summary: session.memorySummary };
        
        logger.log('Memory threshold reached, summarizing...', { totalTokens, contextSize });
        const sliceIndex = Math.floor(currentMessages.length * MEMORY_SLICE_PERCENT);
        const messagesToSummarize = currentMessages.slice(0, sliceIndex);
        const remainingMessages = currentMessages.slice(sliceIndex);
        
        try {
          const { provider, apiKeys, models } = settings;
          const model = models?.[provider] || '';
          const apiKey = provider === LLMProvider.GEMINI ? process.env.API_KEY || '' : apiKeys[provider];
          if (!apiKey || !model) throw new Error(`API key or model for ${provider} is not configured.`);
          
          const newSummary = await summarizeMessages({ provider, apiKey, model, messages: messagesToSummarize, previousSummary: session.memorySummary });
          const sysMsg: Message = { id: crypto.randomUUID(), role: 'system', content: '[System: Distant memories were summarized to preserve context.]', timestamp: Date.now() };
          set(state => ({ messages: { ...state.messages, [sysMsg.id]: sysMsg } }));
          
          return { messages: [sysMsg, ...remainingMessages], summary: newSummary };
        } catch (err) {
          logger.error('Auto-summarization failed.', { error: err });
          useUIStore.getState().setError('Auto-summarization failed. Check API key and model settings.');
          return { messages: currentMessages, summary: session.memorySummary };
        }
      };

      const executeSingleChatGeneration = async (
        sessionId: string,
        messagesToProcess: Message[],
        isContinuation: boolean = false
      ) => {
        const { setIsLoading, setError, setAbortController } = useUIStore.getState();
        setIsLoading(true);
        setError(null);
        const controller = new AbortController();
        setAbortController(controller);

        const session = get().sessions[sessionId];
        if (!session) {
            setIsLoading(false);
            return;
        }

        const assistantMessage: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: Date.now() };
        set(state => ({
            messages: { ...state.messages, [assistantMessage.id]: assistantMessage },
            sessions: { ...state.sessions, [sessionId]: { ...session, messageIds: [...session.messageIds, assistantMessage.id] } }
        }));

        try {
            const { settings, userPersona } = useSettingsStore.getState();
            const { worlds, worldEntryInteractions } = useWorldStore.getState();
            const { characters } = useCharacterStore.getState();
            const { activeCharacterId } = useUIStore.getState();
            const character = characters.find(c => c.id === activeCharacterId);
            if (!character) throw new Error("Active character not found");

            const { provider, apiKeys, models, systemPrompt } = settings;
            const apiKey = provider === LLMProvider.GEMINI ? process.env.API_KEY || '' : apiKeys[provider];
            const model = models?.[provider] || '';
            const world = worlds.find(w => w.id === session.worldId);

            const stream = getChatCompletionStream({
                provider, apiKey, model,
                messages: messagesToProcess,
                characterPersona: character.persona,
                userPersona,
                globalSystemPrompt: systemPrompt,
                world: world || null,
                temperature: session.temperature ?? settings.temperature,
                prefill: isContinuation ? '' : settings.responsePrefill,
                signal: controller.signal,
                contextSize: session.contextSize ?? settings.contextSize,
                maxOutputTokens: session.maxOutputTokens ?? settings.maxOutputTokens,
                memorySummary: session.memorySummary,
                characterName: character.name,
                interactionData: worldEntryInteractions[world?.id || '']
            });

            let accumulatedText = '';
            let lastRenderTime = 0;
            for await (const chunk of stream) {
                accumulatedText += chunk;
                if (Date.now() - lastRenderTime > RENDER_INTERVAL) {
                    set(state => ({ messages: { ...state.messages, [assistantMessage.id]: { ...assistantMessage, content: accumulatedText } }}));
                    lastRenderTime = Date.now();
                }
            }

            set(state => ({ messages: { ...state.messages, [assistantMessage.id]: { ...assistantMessage, content: accumulatedText, timestamp: Date.now() } }}));
        } catch (error) {
            const errorMessage = `Error: ${extractErrorMessage(error)}`;
            setError(errorMessage);
            set(state => ({ messages: { ...state.messages, [assistantMessage.id]: { ...assistantMessage, content: errorMessage, timestamp: Date.now() } }}));
        } finally {
            setIsLoading(false);
            setAbortController(null);
        }
      };

      return {
        // --- State ---
        sessions: {},
        groupSessions: {},
        messages: {},
        characterSessions: {},

        // --- Single Chat Actions ---
        newSession: (characterId) => {
            const { characters } = useCharacterStore.getState();
            const { settings } = useSettingsStore.getState();
            const character = characters.find(c => c.id === characterId);
            if (!character) return '';

            const greetingMessage: Message | null = character.greeting ? { id: crypto.randomUUID(), role: 'assistant', content: character.greeting, timestamp: Date.now() } : null;
            
            const newSessionData: Session = {
                id: crypto.randomUUID(),
                title: `New Chat - ${new Date().toLocaleDateString()}`,
                messageIds: greetingMessage ? [greetingMessage.id] : [],
                worldId: settings.worldId,
                temperature: settings.temperature,
                contextSize: settings.contextSize,
                maxOutputTokens: settings.maxOutputTokens,
                memoryEnabled: false,
            };

            set(state => ({
                sessions: { ...state.sessions, [newSessionData.id]: newSessionData },
                messages: greetingMessage ? { ...state.messages, [greetingMessage.id]: greetingMessage } : state.messages,
                characterSessions: { ...state.characterSessions, [characterId]: [...(state.characterSessions[characterId] || []), newSessionData.id] },
            }));
            
            return newSessionData.id;
        },

        sendMessage: async (content) => {
            const { activeSessionId } = useUIStore.getState();
            if (!activeSessionId) return;

            const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content, timestamp: Date.now() };
            
            let session, currentMessages;
            set(state => {
                session = state.sessions[activeSessionId!];
                if (!session) return state;
                const updatedMessages = { ...state.messages, [userMessage.id]: userMessage };
                currentMessages = [...session.messageIds, userMessage.id].map(id => updatedMessages[id]);
                return {
                    messages: updatedMessages,
                    sessions: { ...state.sessions, [activeSessionId!]: { ...session, messageIds: [...session.messageIds, userMessage.id] } }
                };
            });
            
            if (!get().sessions[activeSessionId]) return;

            const { messages: processedMessages, summary: newSummary } = await handleSummarization(get().sessions[activeSessionId], currentMessages!);
            if (newSummary !== get().sessions[activeSessionId].memorySummary || processedMessages.length !== currentMessages!.length) {
                set(state => {
                    const session = state.sessions[activeSessionId!];
                    return {
                        sessions: { ...state.sessions, [activeSessionId!]: { ...session, memorySummary: newSummary, messageIds: processedMessages.map(m => m.id) } }
                    }
                });
            }

            await executeSingleChatGeneration(activeSessionId, processedMessages);
        },

        editMessage: (sessionId, messageId, newContent) => {
            set(state => {
                const message = state.messages[messageId];
                if (!message) return state;
                return {
                    messages: { ...state.messages, [messageId]: { ...message, content: newContent } }
                };
            });
        },

        deleteMessage: (sessionId, messageId) => {
            set(state => {
                const session = state.sessions[sessionId];
                if (!session) return state;
                const newMessages = { ...state.messages };
                delete newMessages[messageId];
                return {
                    messages: newMessages,
                    sessions: { ...state.sessions, [sessionId]: { ...session, messageIds: session.messageIds.filter(id => id !== messageId) } }
                };
            });
        },

        regenerateResponse: async (sessionId) => {
            const session = get().sessions[sessionId];
            if (!session) return;
            const allMessages = session.messageIds.map(id => get().messages[id]);
            const lastUserIndex = allMessages.map(m => m.role).lastIndexOf('user');
            if (lastUserIndex === -1) return;

            const messagesToProcess = allMessages.slice(0, lastUserIndex + 1);
            set(state => ({
                sessions: { ...state.sessions, [sessionId]: { ...session, messageIds: messagesToProcess.map(m => m.id) } }
            }));

            await executeSingleChatGeneration(sessionId, messagesToProcess, true);
        },

        continueGeneration: (sessionId) => executeSingleChatGeneration(sessionId, get().sessions[sessionId].messageIds.map(id => get().messages[id]), true),

        forkChat: (sessionId, messageId) => {
            const { activeCharacterId } = useUIStore.getState();
            if (!activeCharacterId) return '';
            const session = get().sessions[sessionId];
            if (!session) return '';

            const messageIndex = session.messageIds.indexOf(messageId);
            if (messageIndex === -1) return '';
            
            const newHistoryIds = session.messageIds.slice(0, messageIndex + 1);
            const newSessionData: Session = {
                ...session,
                id: crypto.randomUUID(),
                title: `Fork of ${session.title}`,
                messageIds: newHistoryIds,
            };
            
            set(state => ({
                sessions: { ...state.sessions, [newSessionData.id]: newSessionData },
                characterSessions: { ...state.characterSessions, [activeCharacterId]: [...(state.characterSessions[activeCharacterId] || []), newSessionData.id] },
            }));

            useUIStore.getState().setActiveSessionId(newSessionData.id);
            return newSessionData.id;
        },

        deleteSession: (characterId, sessionId) => {
            const session = get().sessions[sessionId];
            if (!session) return;
            const messagesToDelete = new Set(session.messageIds);
            
            set(state => {
                const newSessions = { ...state.sessions };
                delete newSessions[sessionId];
                const newMessages = { ...state.messages };
                messagesToDelete.forEach(id => delete newMessages[id]);
                const newCharSessions = { ...state.characterSessions };
                newCharSessions[characterId] = (newCharSessions[characterId] || []).filter(id => id !== sessionId);

                return {
                    sessions: newSessions,
                    messages: newMessages,
                    characterSessions: newCharSessions
                };
            });
        },

        // --- Group Chat Actions ---
        createGroupChat: (characterIds, scenario) => {
            const { characters } = useCharacterStore.getState();
            const sessionChars = characterIds.map(id => characters.find(c => c.id === id)).filter(Boolean) as Character[];
            
            const newGroupSession: GroupSession = {
                id: crypto.randomUUID(),
                title: `Group: ${sessionChars.map(c => c.name).slice(0, 3).join(', ')}`,
                characterIds,
                scenario,
                messageIds: [],
            };

            set(state => ({
                groupSessions: { ...state.groupSessions, [newGroupSession.id]: newGroupSession }
            }));

            const { setActiveGroupSessionId, setCurrentView } = useUIStore.getState();
            setActiveGroupSessionId(newGroupSession.id);
            setCurrentView('GROUP_CHAT');
            return newGroupSession.id;
        },

        sendGroupMessage: async (content) => { /* Similar to sendMessage, but for groups */ },
        editGroupMessage: (sessionId, messageId, newContent) => { get().editMessage(sessionId, messageId, newContent) },
        deleteGroupMessage: (sessionId, messageId) => { get().deleteMessage(sessionId, messageId) },
        regenerateGroupResponse: async (sessionId) => { /* Similar to regenerate, but for groups */ },
        continueGroupGeneration: async (sessionId) => { /* Similar to continue, but for groups */ },
        forkGroupChat: (sessionId, messageId) => { /* Similar to fork, but for groups */ return ''},

        deleteGroupSession: (sessionId) => {
            const session = get().groupSessions[sessionId];
            if (!session) return;
            const messagesToDelete = new Set(session.messageIds);
            set(state => {
                const newGroupSessions = { ...state.groupSessions };
                delete newGroupSessions[sessionId];
                const newMessages = { ...state.messages };
                messagesToDelete.forEach(id => delete newMessages[id]);
                return { groupSessions: newGroupSessions, messages: newMessages };
            });
        },

        // --- Cross-slice utility actions ---
// FIX: Refactor to avoid calling get() inside set() and to properly handle state updates.
        deleteChatsForCharacter: (characterId) => {
            const { characterSessions, deleteSession, groupSessions, deleteGroupSession } = get();
            const sessionsForChar = characterSessions[characterId] || [];
            sessionsForChar.forEach(sessionId => {
                deleteSession(characterId, sessionId);
            });

            Object.values(groupSessions).forEach(gs => {
                if (gs.characterIds.includes(characterId)) {
                    deleteGroupSession(gs.id);
                }
            });
        },

// FIX: Implement immutable updates for unlinking worlds to prevent direct state mutation and fix type errors.
        unlinkWorldFromAllSessions: (worldId) => {
            set(state => {
                const newSessions: Record<string, Session> = {};
                for (const sessionId in state.sessions) {
                    const session = state.sessions[sessionId];
                    newSessions[sessionId] = session.worldId === worldId ? { ...session, worldId: null } : session;
                }

                const newGroupSessions: Record<string, GroupSession> = {};
                for (const sessionId in state.groupSessions) {
                    const session = state.groupSessions[sessionId];
                    newGroupSessions[sessionId] = session.worldId === worldId ? { ...session, worldId: null } : session;
                }

                return { sessions: newSessions, groupSessions: newGroupSessions };
            });
        },
        
        // --- Session Settings ---
// FIX: Refactor session setting updates to be type-safe by avoiding dynamic key access on the state object.
        setSessionWorld: (sessionId, worldId, isGroup = false) => {
            set(state => {
                if (isGroup) {
                    const session = state.groupSessions[sessionId];
                    if (!session) return state;
                    return { ...state, groupSessions: { ...state.groupSessions, [sessionId]: { ...session, worldId } }};
                } else {
                    const session = state.sessions[sessionId];
                    if (!session) return state;
                    return { ...state, sessions: { ...state.sessions, [sessionId]: { ...session, worldId } }};
                }
            });
        },
        setSessionTemperature: (sessionId, temperature, isGroup = false) => {
            set(state => {
                if (isGroup) {
                    const session = state.groupSessions[sessionId];
                    if (!session) return state;
                    return { ...state, groupSessions: { ...state.groupSessions, [sessionId]: { ...session, temperature } }};
                } else {
                    const session = state.sessions[sessionId];
                    if (!session) return state;
                    return { ...state, sessions: { ...state.sessions, [sessionId]: { ...session, temperature } }};
                }
            });
        },
        setSessionContextSize: (sessionId, contextSize, isGroup = false) => {
            set(state => {
                if (isGroup) {
                    const session = state.groupSessions[sessionId];
                    if (!session) return state;
                    return { ...state, groupSessions: { ...state.groupSessions, [sessionId]: { ...session, contextSize } }};
                } else {
                    const session = state.sessions[sessionId];
                    if (!session) return state;
                    return { ...state, sessions: { ...state.sessions, [sessionId]: { ...session, contextSize } }};
                }
            });
        },
        setSessionMaxOutputTokens: (sessionId, maxOutputTokens, isGroup = false) => {
             set(state => {
                if (isGroup) {
                    const session = state.groupSessions[sessionId];
                    if (!session) return state;
                    return { ...state, groupSessions: { ...state.groupSessions, [sessionId]: { ...session, maxOutputTokens } }};
                } else {
                    const session = state.sessions[sessionId];
                    if (!session) return state;
                    return { ...state, sessions: { ...state.sessions, [sessionId]: { ...session, maxOutputTokens } }};
                }
            });
        },
        setSessionMemoryEnabled: (sessionId, enabled, isGroup = false) => {
            set(state => {
                if (isGroup) {
                    const session = state.groupSessions[sessionId];
                    if (!session) return state;
                    return { ...state, groupSessions: { ...state.groupSessions, [sessionId]: { ...session, memoryEnabled: enabled } }};
                } else {
                    const session = state.sessions[sessionId];
                    if (!session) return state;
                    return { ...state, sessions: { ...state.sessions, [sessionId]: { ...session, memoryEnabled: enabled } }};
                }
            });
        }
      };
    },
    {
      name: 'roleplay-nexus-chat',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);