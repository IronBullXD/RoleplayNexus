import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Character, Message, ChatSession, GroupChatSession, LLMProvider, GroupTurnAction, ThinkingStep } from '../../types';
import { useUIStore } from './uiStore';
import { useSettingsStore } from './settingsStore';
import { useWorldStore } from './worldStore';
import { useCharacterStore } from './characterStore';
import { getChatCompletionStream, getGroupChatCompletion, summarizeMessages, isApiError } from '../../services/llmService';
import { generateResponseWithThinking } from '../../services/thinkingService';
import { logger } from '../../services/logger';
import { ERROR_MESSAGES } from '../../services/errorMessages';

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
  regenerateGroupResponse: () => Promise<void>;
  continueGroupGeneration: () => Promise<void>;
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
    if (error instanceof Error) {
        if (error.name === 'AbortError') return 'Generation stopped by user.';
        return error.message; // Assume llmService now provides standardized, user-friendly messages
    }
    if (typeof error === 'string') return error;
    return ERROR_MESSAGES.UNKNOWN_ERROR;
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
          const apiKey = provider === LLMProvider.GEMINI ? process.env.API_KEY || '' : apiKeys[provider as LLMProvider];
          if (!apiKey || !model) throw new Error(ERROR_MESSAGES.API_KEY_MISSING(provider));
          
          const newSummary = await summarizeMessages({ provider, apiKey, model, messages: messagesToSummarize, previousSummary: session.memorySummary });
          const sysMsg: Message = { id: crypto.randomUUID(), role: 'system', content: '[System: Distant memories were summarized to preserve context.]', timestamp: Date.now() };
          set((state: ChatStore) => ({ messages: { ...state.messages, [sysMsg.id]: sysMsg } }));
          
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
        
        const { settings, userPersona } = useSettingsStore.getState();
        const useThinking = settings.thinkingEnabled && !isContinuation;

        const assistantMessage: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: Date.now(), isThinking: useThinking, thinkingProcess: [] };
        set((state: ChatStore) => {
            const currentSession = state.sessions[sessionId];
            if (!currentSession) return state;
            return {
                messages: { ...state.messages, [assistantMessage.id]: assistantMessage },
                sessions: { ...state.sessions, [sessionId]: { ...currentSession, messageIds: [...currentSession.messageIds, assistantMessage.id] } }
            };
        });

        try {
            const { worlds, worldEntryInteractions } = useWorldStore.getState();
            const { characters } = useCharacterStore.getState();
            const { activeCharacterId } = useUIStore.getState();
            const character = characters.find(c => c.id === activeCharacterId);
            if (!character) throw new Error("Active character not found");

            const { provider, apiKeys, models } = settings;
            // FIX: Restore type assertion. The type of 'provider' can be broadened to 'unknown' after rehydration from storage.
            const apiKey = provider === LLMProvider.GEMINI ? process.env.API_KEY || '' : apiKeys[provider as LLMProvider];
            const model = models?.[provider] || '';
            const world = worlds.find(w => w.id === session.worldId);
            const worldId = world?.id || '';

            const completionParams = {
                provider, apiKey, model,
                messages: messagesToProcess,
                characterPersona: character.persona,
                userPersona,
                globalSystemPrompt: settings.systemPrompt,
                world: world || null,
                temperature: session.temperature ?? settings.temperature,
                prefill: isContinuation ? '' : settings.responsePrefill,
                signal: controller.signal,
                contextSize: session.contextSize ?? settings.contextSize,
                maxOutputTokens: session.maxOutputTokens ?? settings.maxOutputTokens,
                memorySummary: session.memorySummary,
                characterName: character.name,
                interactionData: worldId ? worldEntryInteractions[worldId] : undefined,
                settings, // Pass all settings for thinking service
            };

            const stream = useThinking ? generateResponseWithThinking(completionParams) : getChatCompletionStream(completionParams);

            let accumulatedText = '';
            let lastRenderTime = 0;
            for await (const result of stream) {
                const isThinkingResult = typeof result === 'object';
                if (isThinkingResult && result.type === 'step') {
                    set((state: ChatStore) => {
                        const msg = state.messages[assistantMessage.id];
                        if (!msg) return state;
                        return { messages: { ...state.messages, [assistantMessage.id]: { ...msg, thinkingProcess: [...(msg.thinkingProcess || []), result.payload as ThinkingStep] } }};
                    });
                } else if (isThinkingResult && result.type === 'start_response') {
                     set((state: ChatStore) => {
                        const msg = state.messages[assistantMessage.id];
                        if (!msg) return state;
                        return { messages: { ...state.messages, [assistantMessage.id]: { ...msg, isThinking: false } }};
                    });
                } else {
                    const chunk = isThinkingResult ? (result.payload as string) : (result as string);
                    accumulatedText += chunk;
                    if (Date.now() - lastRenderTime > RENDER_INTERVAL) {
                        set((state: ChatStore) => {
                            const currentMessage = state.messages[assistantMessage.id];
                            if (!currentMessage) return state;
                            return { messages: { ...state.messages, [assistantMessage.id]: { ...currentMessage, isThinking: false, content: accumulatedText } }};
                        });
                        lastRenderTime = Date.now();
                    }
                }
            }

            set((state: ChatStore) => {
                const finalMessage = state.messages[assistantMessage.id];
                if (!finalMessage) return state;
                return { messages: { ...state.messages, [assistantMessage.id]: { ...finalMessage, isThinking: false, content: accumulatedText, timestamp: Date.now() } }};
            });
        } catch (error) {
            const errorMessage = `Error: ${extractErrorMessage(error)}`;
            setError(errorMessage);
            set((state: ChatStore) => {
                const errorMsg = state.messages[assistantMessage.id];
                if (!errorMsg) return state;
                return { messages: { ...state.messages, [assistantMessage.id]: { ...errorMsg, isThinking: false, content: errorMessage, timestamp: Date.now() } }};
            });
        } finally {
            setIsLoading(false);
            setAbortController(null);
        }
      };
      
      const executeGroupChatGeneration = async (
        sessionId: string,
        messagesToProcess: Message[],
      ) => {
        const { setIsLoading, setError, setAbortController } = useUIStore.getState();
        setIsLoading(true);
        setError(null);
        const controller = new AbortController();
        setAbortController(controller);
      
        try {
          const session = get().groupSessions[sessionId];
          if (!session) throw new Error('Group session not found.');
      
          const { settings, userPersona } = useSettingsStore.getState();
          const { worlds, worldEntryInteractions } = useWorldStore.getState();
          const { characters } = useCharacterStore.getState();
          
          const sessionCharacters = session.characterIds.map(id => characters.find(c => c.id === id)).filter(Boolean) as Character[];
      
          const { provider, apiKeys, models } = settings;
          // FIX: Restore type assertion. The type of 'provider' can be broadened to 'unknown' after rehydration from storage.
          const apiKey = provider === LLMProvider.GEMINI ? process.env.API_KEY || '' : apiKeys[provider as LLMProvider];
          const model = models?.[provider] || '';
          const world = worlds.find(w => w.id === session.worldId);
          const worldId = world?.id || '';
      
          const turnActions: GroupTurnAction[] = await getGroupChatCompletion({
            provider, apiKey, model,
            messages: messagesToProcess,
            sessionCharacters: sessionCharacters.map(c => ({ name: c.name, persona: c.persona })),
            scenario: session.scenario,
            userPersona,
            globalSystemPrompt: settings.systemPrompt,
            world: world || null,
            temperature: session.temperature ?? settings.temperature,
            contextSize: session.contextSize ?? settings.contextSize,
            maxOutputTokens: session.maxOutputTokens ?? settings.maxOutputTokens,
            memorySummary: session.memorySummary,
            activeCharacterNames: sessionCharacters.map(c => c.name),
            interactionData: worldId ? worldEntryInteractions[worldId] : undefined,
            settings,
          });
      
          const newMessages: Message[] = turnActions.map(action => {
            const character = action.characterName === 'Narrator' ? null : sessionCharacters.find(c => c.name === action.characterName);
            return {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: action.content,
              characterId: character ? character.id : 'narrator',
              timestamp: Date.now(),
            };
          });
      
          set((state: ChatStore) => {
            const currentSession = state.groupSessions[sessionId];
            if (!currentSession) return state;
            const updatedMessages = { ...state.messages };
            newMessages.forEach(msg => {
              updatedMessages[msg.id] = msg;
            });
            return {
              messages: updatedMessages,
              groupSessions: {
                ...state.groupSessions,
                [sessionId]: {
                  ...currentSession,
                  messageIds: [...currentSession.messageIds, ...newMessages.map(m => m.id)],
                }
              }
            };
          });
      
        } catch (error) {
            const errorMessage = `Error: ${extractErrorMessage(error)}`;
            setError(errorMessage);
            const errorMessageObj: Message = { id: crypto.randomUUID(), role: 'assistant', content: errorMessage, timestamp: Date.now() };
            set((state: ChatStore) => {
                const currentSession = state.groupSessions[sessionId];
                if (!currentSession) return state;
                return {
                    messages: { ...state.messages, [errorMessageObj.id]: errorMessageObj },
                    groupSessions: { ...state.groupSessions, [sessionId]: { ...currentSession, messageIds: [...currentSession.messageIds, errorMessageObj.id] } }
                };
            });
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
        newSession: (characterId: string) => {
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

            set((state: ChatStore) => ({
                sessions: { ...state.sessions, [newSessionData.id]: newSessionData },
                messages: greetingMessage ? { ...state.messages, [greetingMessage.id]: greetingMessage } : state.messages,
                characterSessions: { ...state.characterSessions, [characterId]: [...(state.characterSessions[characterId] || []), newSessionData.id] },
            }));
            
            return newSessionData.id;
        },

        sendMessage: async (content: string) => {
            const { activeSessionId } = useUIStore.getState();
            if (!activeSessionId) return;

            const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content, timestamp: Date.now() };
            
            let session, currentMessages;
            set((state: ChatStore) => {
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
                set((state: ChatStore) => {
                    const session = state.sessions[activeSessionId!];
                    if (!session) return state;
                    return {
                        sessions: { ...state.sessions, [activeSessionId!]: { ...session, memorySummary: newSummary, messageIds: processedMessages.map(m => m.id) } }
                    }
                });
            }

            await executeSingleChatGeneration(activeSessionId, processedMessages);
        },

        editMessage: (sessionId: string, messageId: string, newContent: string) => {
            set((state: ChatStore) => {
                const message = state.messages[messageId];
                if (!message) return state;
                return {
                    messages: { ...state.messages, [messageId]: { ...message, content: newContent } }
                };
            });
        },

        deleteMessage: (sessionId: string, messageId: string) => {
            set((state: ChatStore) => {
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

        regenerateResponse: async (sessionId: string) => {
            const session = get().sessions[sessionId];
            if (!session) return;
            const allMessages = session.messageIds.map(id => get().messages[id]);
            const lastUserIndex = allMessages.map(m => m.role).lastIndexOf('user');
            if (lastUserIndex === -1) return;

            const messagesToProcess = allMessages.slice(0, lastUserIndex + 1);
            set((state: ChatStore) => ({
                sessions: { ...state.sessions, [sessionId]: { ...session, messageIds: messagesToProcess.map(m => m.id) } }
            }));

            // Regeneration should not be a "continuation", so pass `false`.
            // This allows the thinking process to trigger if it's enabled.
            await executeSingleChatGeneration(sessionId, messagesToProcess, false);
        },

        continueGeneration: (sessionId: string) => executeSingleChatGeneration(sessionId, get().sessions[sessionId].messageIds.map(id => get().messages[id]), true),

        forkChat: (sessionId: string, messageId: string) => {
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
            
            set((state: ChatStore) => ({
                sessions: { ...state.sessions, [newSessionData.id]: newSessionData },
                characterSessions: { ...state.characterSessions, [activeCharacterId]: [...(state.characterSessions[activeCharacterId] || []), newSessionData.id] },
            }));

            useUIStore.getState().setActiveSessionId(newSessionData.id);
            return newSessionData.id;
        },

        deleteSession: (characterId: string, sessionId: string) => {
            const session = get().sessions[sessionId];
            if (!session) return;
            const messagesToDelete = new Set(session.messageIds);
            
            set((state: ChatStore) => {
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
        createGroupChat: (characterIds: string[], scenario: string) => {
            const { characters } = useCharacterStore.getState();
            const sessionChars = characterIds.map(id => characters.find(c => c.id === id)).filter(Boolean) as Character[];
            
            const newGroupSession: GroupSession = {
                id: crypto.randomUUID(),
                title: `Group: ${sessionChars.map(c => c.name).slice(0, 3).join(', ')}`,
                characterIds,
                scenario,
                messageIds: [],
            };

            set((state: ChatStore) => ({
                groupSessions: { ...state.groupSessions, [newGroupSession.id]: newGroupSession }
            }));

            const { setActiveGroupSessionId, setCurrentView } = useUIStore.getState();
            setActiveGroupSessionId(newGroupSession.id);
            setCurrentView('GROUP_CHAT');
            return newGroupSession.id;
        },

        sendGroupMessage: async (content: string) => {
          const { activeGroupSessionId } = useUIStore.getState();
          if (!activeGroupSessionId) return;
      
          const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content, timestamp: Date.now() };
          
          let session, currentMessages;
          set((state: ChatStore) => {
              session = state.groupSessions[activeGroupSessionId!];
              if (!session) return state;
              const updatedMessages = { ...state.messages, [userMessage.id]: userMessage };
              currentMessages = [...session.messageIds, userMessage.id].map(id => updatedMessages[id]);
              return {
                  messages: updatedMessages,
                  groupSessions: { ...state.groupSessions, [activeGroupSessionId!]: { ...session, messageIds: [...session.messageIds, userMessage.id] } }
              };
          });
          
          if (!get().groupSessions[activeGroupSessionId]) return;
      
          const { messages: processedMessages, summary: newSummary } = await handleSummarization(get().groupSessions[activeGroupSessionId], currentMessages!);
          if (newSummary !== get().groupSessions[activeGroupSessionId].memorySummary || processedMessages.length !== currentMessages!.length) {
              set((state: ChatStore) => {
                  const session = state.groupSessions[activeGroupSessionId!];
                   if (!session) return state;
                  return {
                      groupSessions: { ...state.groupSessions, [activeGroupSessionId!]: { ...session, memorySummary: newSummary, messageIds: processedMessages.map(m => m.id) } }
                  }
              });
          }
      
          await executeGroupChatGeneration(activeGroupSessionId, processedMessages);
        },
        editGroupMessage: (sessionId: string, messageId: string, newContent: string) => {
          set((state: ChatStore) => {
            const message = state.messages[messageId];
            if (!message) return state;
            return {
                messages: { ...state.messages, [messageId]: { ...message, content: newContent } }
            };
          });
        },
        deleteGroupMessage: (sessionId: string, messageId: string) => {
          set((state: ChatStore) => {
            const session = state.groupSessions[sessionId];
            if (!session) return state;
            const newMessages = { ...state.messages };
            delete newMessages[messageId];
            return {
                messages: newMessages,
                groupSessions: { ...state.groupSessions, [sessionId]: { ...session, messageIds: session.messageIds.filter(id => id !== messageId) } }
            };
          });
        },
        regenerateGroupResponse: async () => {
          const { activeGroupSessionId } = useUIStore.getState();
          if (!activeGroupSessionId) return;
          const sessionId = activeGroupSessionId;
          const session = get().groupSessions[sessionId];
          if (!session) return;
          const allMessages = session.messageIds.map(id => get().messages[id]);
          const lastUserIndex = allMessages.map(m => m.role).lastIndexOf('user');
          if (lastUserIndex === -1) return;
      
          const messagesToProcess = allMessages.slice(0, lastUserIndex + 1);
          set((state: ChatStore) => ({
              groupSessions: { ...state.groupSessions, [sessionId]: { ...session, messageIds: messagesToProcess.map(m => m.id) } }
          }));
      
          await executeGroupChatGeneration(sessionId, messagesToProcess);
        },
        continueGroupGeneration: async () => {
          const { activeGroupSessionId } = useUIStore.getState();
          if (!activeGroupSessionId) return;
          const sessionId = activeGroupSessionId;
          const session = get().groupSessions[sessionId];
          if (!session) return;
          const messagesToProcess = session.messageIds.map(id => get().messages[id]);
          await executeGroupChatGeneration(sessionId, messagesToProcess);
        },
        forkGroupChat: (sessionId: string, messageId: string) => {
          const session = get().groupSessions[sessionId];
          if (!session) return '';
      
          const messageIndex = session.messageIds.indexOf(messageId);
          if (messageIndex === -1) return '';
          
          const newHistoryIds = session.messageIds.slice(0, messageIndex + 1);
          const newSessionData: GroupSession = {
              ...session,
              id: crypto.randomUUID(),
              title: `Fork of ${session.title}`,
              messageIds: newHistoryIds,
          };
          
          set((state: ChatStore) => ({
              groupSessions: { ...state.groupSessions, [newSessionData.id]: newSessionData },
          }));
      
          useUIStore.getState().setActiveGroupSessionId(newSessionData.id);
          return newSessionData.id;
        },

        deleteGroupSession: (sessionId: string) => {
            const session = get().groupSessions[sessionId];
            if (!session) return;
            const messagesToDelete = new Set(session.messageIds);
            set((state: ChatStore) => {
                const newGroupSessions = { ...state.groupSessions };
                delete newGroupSessions[sessionId];
                const newMessages = { ...state.messages };
                messagesToDelete.forEach(id => delete newMessages[id]);
                return { groupSessions: newGroupSessions, messages: newMessages };
            });
        },

        // --- Cross-slice utility actions ---
        deleteChatsForCharacter: (characterId: string) => {
            set((state: ChatStore) => {
                const sessionsToDelete = new Set(state.characterSessions[characterId] || []);
                const messagesToDelete = new Set<string>();

                sessionsToDelete.forEach(sessionId => {
                    const session = state.sessions[sessionId];
                    if (session) {
                        session.messageIds.forEach(msgId => messagesToDelete.add(msgId));
                    }
                });

                const groupSessionsToDelete = new Set<string>();
                Object.values(state.groupSessions).forEach(gs => {
                    if (gs.characterIds.includes(characterId)) {
                        groupSessionsToDelete.add(gs.id);
                        gs.messageIds.forEach(msgId => messagesToDelete.add(msgId));
                    }
                });
                
                const newSessions = { ...state.sessions };
                sessionsToDelete.forEach(id => delete newSessions[id]);

                const newGroupSessions = { ...state.groupSessions };
                groupSessionsToDelete.forEach(id => delete newGroupSessions[id]);
                
                const newMessages = { ...state.messages };
                messagesToDelete.forEach(id => delete newMessages[id]);
                
                const newCharSessions = { ...state.characterSessions };
                delete newCharSessions[characterId];

                return {
                    ...state,
                    sessions: newSessions,
                    groupSessions: newGroupSessions,
                    messages: newMessages,
                    characterSessions: newCharSessions,
                };
            });
        },

        unlinkWorldFromAllSessions: (worldId: string) => {
            set((state: ChatStore) => {
                const updatedSessions = Object.fromEntries(
                    Object.entries(state.sessions).map(([id, session]) => [
                        id,
                        session.worldId === worldId ? { ...session, worldId: null } : session,
                    ])
                );
                const updatedGroupSessions = Object.fromEntries(
                    Object.entries(state.groupSessions).map(([id, session]) => [
                        id,
                        session.worldId === worldId ? { ...session, worldId: null } : session,
                    ])
                );
                return { ...state, sessions: updatedSessions, groupSessions: updatedGroupSessions };
            });
        },
        
        // --- Session Settings ---
        setSessionWorld: (sessionId: string, worldId: string | null, isGroup: boolean = false) => {
            set((state: ChatStore) => {
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
        setSessionTemperature: (sessionId: string, temperature: number, isGroup: boolean = false) => {
            set((state: ChatStore) => {
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
        setSessionContextSize: (sessionId: string, contextSize: number, isGroup: boolean = false) => {
            set((state: ChatStore) => {
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
        setSessionMaxOutputTokens: (sessionId: string, maxOutputTokens: number, isGroup: boolean = false) => {
             set((state: ChatStore) => {
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
        setSessionMemoryEnabled: (sessionId: string, enabled: boolean, isGroup: boolean = false) => {
            set((state: ChatStore) => {
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