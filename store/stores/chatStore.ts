import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Character, Message, ChatSession, GroupChatSession, LLMProvider, GroupTurnAction, ThinkingStep, Settings } from '../../types';
import { useUIStore } from './uiStore';
import { useSettingsStore } from './settingsStore';
import { useWorldStore } from './worldStore';
import { useCharacterStore } from './characterStore';
import { getChatCompletionStream, getGroupChatCompletion, summarizeMessages } from '../../services/llmService';
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
  deleteMultipleMessages: (sessionId: string, messageIds: string[]) => void;
  regenerateResponse: (sessionId: string) => Promise<void>;
  continueGeneration: (sessionId: string) => Promise<void>;
  setActiveAlternate: (sessionId: string, messageId: string, direction: 'prev' | 'next') => void;
  newSession: (characterId: string) => string;
  forkChat: (sessionId: string, messageId: string) => string;
  deleteSession: (characterId: string, sessionId: string) => void;
  sendGroupMessage: (content: string) => Promise<void>;
  editGroupMessage: (sessionId: string, messageId: string, newContent: string) => void;
  deleteGroupMessage: (sessionId: string, messageId: string) => void;
  deleteMultipleGroupMessages: (sessionId: string, messageIds: string[]) => void;
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
  exportChats: (sessionIds: string[], groupSessionIds: string[]) => void;
  importChats: (jsonString: string) => void;
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

interface SingleChatGenOptions {
  regenerationInfo?: { originalMessageId: string };
  appendToMessageId?: string;
}

// --- Store Definition ---
export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => {
      const handleSummarization = async (
        session: Session | GroupSession,
        currentMessages: Message[],
      ): Promise<{ messages: Message[]; summary: string | undefined }> => {
        const { settings: rawSettings } = useSettingsStore.getState();
        const settings = rawSettings as Settings;
        const contextSize = session.contextSize ?? settings.contextSize;
        if (!session.memoryEnabled || !contextSize || contextSize <= 0) return { messages: currentMessages, summary: session.memorySummary };
        
        const totalTokens = estimateTokens(JSON.stringify(currentMessages));
        if (totalTokens < contextSize * MEMORY_TRIGGER_THRESHOLD) return { messages: currentMessages, summary: session.memorySummary };
        
        logger.log('Memory threshold reached, summarizing...', { totalTokens, contextSize });
        const sliceIndex = Math.floor(currentMessages.length * MEMORY_SLICE_PERCENT);
        const messagesToSummarize = currentMessages.slice(0, sliceIndex);
        const remainingMessages = currentMessages.slice(sliceIndex);
        
        try {
          const { apiKeys, models } = settings;
          const provider = settings.provider;
          const model = models?.[provider] || '';
          const apiKey = provider === LLMProvider.GEMINI ? process.env.API_KEY || '' : apiKeys[provider];
          
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
        options: SingleChatGenOptions = {}
      ) => {
        const { setIsLoading, setError, setAbortController, isLoading } = useUIStore.getState();
        const { appendToMessageId, regenerationInfo } = options;

        if (isLoading) {
          logger.log('Generation already in progress, skipping');
          return;
        }

        setIsLoading(true);
        setError(null);
        const controller = new AbortController();
        setAbortController(controller);

        const session = get().sessions[sessionId];
        if (!session || !messagesToProcess || messagesToProcess.length === 0) {
            logger.log('Session not found or no messages to process during generation');
            setIsLoading(false);
            setAbortController(null);
            return;
        }
        
        const { settings: rawSettings, userPersona } = useSettingsStore.getState();
        const settings = rawSettings as Settings;
        const useThinking = settings.thinkingEnabled && !appendToMessageId;
        
        let assistantMessageId: string;
        let initialContent = '';

        if (appendToMessageId) {
            const existingMessage = get().messages[appendToMessageId];
            if (!existingMessage || existingMessage.role !== 'assistant') {
                setError("Cannot continue generation on a non-assistant message.");
                setIsLoading(false);
                setAbortController(null);
                return;
            }
            assistantMessageId = appendToMessageId;
            initialContent = existingMessage.content;
        } else {
            const newAssistantMessage: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: Date.now(), isThinking: useThinking, thinkingProcess: [] };
            assistantMessageId = newAssistantMessage.id;
            set((state: ChatStore) => {
                const currentSession = state.sessions[sessionId];
                if (!currentSession) return state;
                return {
                    messages: { ...state.messages, [assistantMessageId]: newAssistantMessage },
                    sessions: { ...state.sessions, [sessionId]: { ...currentSession, messageIds: [...currentSession.messageIds, assistantMessageId] } }
                };
            });
        }

        try {
            const { worlds, worldEntryInteractions } = useWorldStore.getState();
            const { characters } = useCharacterStore.getState();
            const { activeCharacterId } = useUIStore.getState();
            const character = characters.find(c => c.id === activeCharacterId);
            if (!character) throw new Error("Active character not found");

            const { apiKeys, models, provider } = settings;
            const apiKey = provider === LLMProvider.GEMINI ? process.env.API_KEY || '' : apiKeys[provider];
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
                prefill: appendToMessageId ? initialContent : settings.responsePrefill,
                signal: controller.signal,
                contextSize: session.contextSize ?? settings.contextSize,
                maxOutputTokens: session.maxOutputTokens ?? settings.maxOutputTokens,
                memorySummary: session.memorySummary,
                characterName: character.name,
                interactionData: worldId ? worldEntryInteractions[worldId] : undefined,
                settings,
            };

            const stream = useThinking ? generateResponseWithThinking(completionParams) : getChatCompletionStream(completionParams);

            let accumulatedText = '';
            let lastRenderTime = 0;
            for await (const result of stream) {
                const isThinkingResult = typeof result === 'object';
                if (isThinkingResult && result.type === 'step') {
                    set((state: ChatStore) => {
                        const msg = state.messages[assistantMessageId];
                        if (!msg) return state;
                        return { messages: { ...state.messages, [assistantMessageId]: { ...msg, thinkingProcess: [...(msg.thinkingProcess || []), result.payload as ThinkingStep] } }};
                    });
                } else if (isThinkingResult && result.type === 'start_response') {
                     set((state: ChatStore) => {
                        const msg = state.messages[assistantMessageId];
                        if (!msg) return state;
                        return { messages: { ...state.messages, [assistantMessageId]: { ...msg, isThinking: false } }};
                    });
                } else {
                    const chunk = isThinkingResult ? (result.payload as string) : (result as string);
                    accumulatedText += chunk;
                    if (Date.now() - lastRenderTime > RENDER_INTERVAL) {
                        set((state: ChatStore) => {
                            const currentMessage = state.messages[assistantMessageId];
                            if (!currentMessage) return state;
                            return { messages: { ...state.messages, [assistantMessageId]: { ...currentMessage, isThinking: false, content: initialContent + accumulatedText } }};
                        });
                        lastRenderTime = Date.now();
                    }
                }
            }

            if (regenerationInfo) {
              const originalMessageId = regenerationInfo.originalMessageId;
              set((state: ChatStore) => {
                  const originalMessage = state.messages[originalMessageId];
                  if (!originalMessage) return state;
      
                  const allAlternateIds = originalMessage.alternates ? [...originalMessage.alternates.ids, assistantMessageId] : [originalMessage.id, assistantMessageId];
                  const newActiveIndex = allAlternateIds.length - 1;
                  const newAlternates = { ids: allAlternateIds, activeIndex: newActiveIndex };
      
                  const updatedMessages = { ...state.messages };
                  allAlternateIds.forEach(id => {
                      if (updatedMessages[id]) {
                          updatedMessages[id] = { ...updatedMessages[id], alternates: newAlternates };
                      }
                  });
                  return { ...state, messages: updatedMessages };
              });
            }
            
            set((state: ChatStore) => {
                const finalMessage = state.messages[assistantMessageId];
                if (!finalMessage) return state;
                return { messages: { ...state.messages, [assistantMessageId]: { ...finalMessage, isThinking: false, content: initialContent + accumulatedText, timestamp: Date.now() } }};
            });
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                logger.log('Generation aborted by user. Keeping partial message.');
            } else {
                const errorMessage = extractErrorMessage(error);
                const errorPrefix = useThinking ? 'Thinking process failed: ' : 'Error: ';
                setError(`${errorPrefix}${errorMessage}`);

                if (!appendToMessageId) {
                  set((state: ChatStore) => {
                      const session = state.sessions[sessionId];
                      if (!session) return state;
                      const newMessageIds = session.messageIds.filter(id => id !== assistantMessageId);
                      const newMessages = { ...state.messages };
                      delete newMessages[assistantMessageId];
                      return {
                          messages: newMessages,
                          sessions: { ...state.sessions, [sessionId]: { ...session, messageIds: newMessageIds } }
                      };
                  });
                }
            }
        } finally {
            setIsLoading(false);
            setAbortController(null);
        }
      };
      
      const executeGroupChatGeneration = async (
        sessionId: string,
        messagesToProcess: Message[],
      ) => {
        const { setIsLoading, setError, setAbortController, isLoading } = useUIStore.getState();

        if (isLoading) {
          logger.log('Group generation already in progress, skipping');
          return;
        }

        setIsLoading(true);
        setError(null);
        const controller = new AbortController();
        setAbortController(controller);
      
        try {
          const session = get().groupSessions[sessionId];
          if (!session) throw new Error('Group session not found.');
      
          const { settings: rawSettings, userPersona } = useSettingsStore.getState();
          const settings = rawSettings as Settings;
          const { worlds, worldEntryInteractions } = useWorldStore.getState();
          const { characters } = useCharacterStore.getState();
          
          const sessionCharacters = session.characterIds.map(id => characters.find(c => c.id === id)).filter(Boolean) as Character[];
      
          const { apiKeys, models, provider } = settings;
          const apiKey = provider === LLMProvider.GEMINI ? process.env.API_KEY || '' : apiKeys[provider];
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
                sessions: {
                    ...state.sessions,
                    [newSessionData.id]: newSessionData,
                },
                messages: greetingMessage ? { ...state.messages, [greetingMessage.id]: greetingMessage } : state.messages,
                characterSessions: {
                    ...state.characterSessions,
                    [characterId]: [...(state.characterSessions[characterId] || []), newSessionData.id],
                },
            }));
            
            return newSessionData.id;
        },

        sendMessage: async (content: string) => {
          const { activeSessionId } = useUIStore.getState();
          if (!activeSessionId) return;
        
          const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content, timestamp: Date.now() };
          
          let session: Session | undefined, currentMessages: Message[] | undefined;
          set((state: ChatStore) => {
            session = state.sessions[activeSessionId!] as Session | undefined;
            if (!session) return state;
            const updatedMessages = { ...state.messages, [userMessage.id]: userMessage };
            currentMessages = [...session.messageIds, userMessage.id].map(id => updatedMessages[id]);

            return {
              messages: updatedMessages,
              sessions: {
                ...state.sessions,
                [activeSessionId!]: { ...session, messageIds: [...session.messageIds, userMessage.id] },
              }
            };
          });
          
          const currentSession = get().sessions[activeSessionId];
          if (!currentSession) {
            logger.log('Session was deleted during message processing');
            return;
          }
        
          const { messages: processedMessages, summary: newSummary } = await handleSummarization(currentSession, currentMessages!);
          if (newSummary !== currentSession.memorySummary || processedMessages.length !== currentMessages!.length) {
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
              const messageToDelete = state.messages[messageId];
              if (!session || !messageToDelete) return state;

              const newMessages = { ...state.messages };
              const idsToDelete = new Set<string>();

              if (messageToDelete.alternates) {
                  messageToDelete.alternates.ids.forEach(id => idsToDelete.add(id));
              } else {
                  idsToDelete.add(messageId);
              }
              
              idsToDelete.forEach(id => delete newMessages[id]);

              const newMessageIds = session.messageIds.filter(id => !idsToDelete.has(id));

              return {
                  messages: newMessages,
                  sessions: { ...state.sessions, [sessionId]: { ...session, messageIds: newMessageIds } }
              };
          });
        },

        deleteMultipleMessages: (sessionId, messageIds) => {
          set((state: ChatStore) => {
              const session = state.sessions[sessionId];
              if (!session) return state;

              const idsToDelete = new Set<string>();
              messageIds.forEach(id => {
                  const message = state.messages[id];
                  if (message) {
                      idsToDelete.add(id);
                      if (message.alternates) {
                          message.alternates.ids.forEach(altId => idsToDelete.add(altId));
                      }
                  }
              });

              const newMessages = { ...state.messages };
              idsToDelete.forEach(id => delete newMessages[id]);

              return {
                  messages: newMessages,
                  sessions: {
                      ...state.sessions,
                      [sessionId]: {
                          ...session,
                          messageIds: session.messageIds.filter(id => !idsToDelete.has(id)),
                      }
                  }
              };
          });
        },

        regenerateResponse: async (sessionId: string) => {
          const session = get().sessions[sessionId];
          if (!session) return;
          const allMessages = session.messageIds.map(id => get().messages[id]);
          const lastUserIndex = allMessages.map(m => m.role).lastIndexOf('user');
          if (lastUserIndex === -1) return;
      
          const originalMessage = allMessages[lastUserIndex + 1];
          const messagesToProcess = allMessages.slice(0, lastUserIndex + 1);
          
          set((state: ChatStore) => ({
              sessions: { ...state.sessions, [sessionId]: { ...session, messageIds: messagesToProcess.map(m => m.id) } }
          }));
          
          const regenerationInfo = originalMessage && originalMessage.role === 'assistant' 
              ? { originalMessageId: originalMessage.id } 
              : undefined;
      
          await executeSingleChatGeneration(sessionId, messagesToProcess, { regenerationInfo });
        },

        continueGeneration: async (sessionId: string) => {
          const session = get().sessions[sessionId];
          if (!session) return;
          const allMessages = session.messageIds.map(id => get().messages[id]);
          const lastMessage = allMessages[allMessages.length - 1];
      
          if (lastMessage && lastMessage.role === 'assistant') {
              await executeSingleChatGeneration(sessionId, allMessages, { appendToMessageId: lastMessage.id });
          } else {
              logger.error("Cannot continue generation: last message is not from the assistant.");
          }
        },

        setActiveAlternate: (sessionId, messageId, direction) => {
            set((state) => {
                const session = state.sessions[sessionId];
                const message = state.messages[messageId];
                if (!session || !message || !message.alternates) return state;
        
                const { ids, activeIndex } = message.alternates;
                let newIndex = activeIndex;
                if (direction === 'prev' && activeIndex > 0) {
                    newIndex = activeIndex - 1;
                } else if (direction === 'next' && activeIndex < ids.length - 1) {
                    newIndex = activeIndex + 1;
                }
        
                if (newIndex === activeIndex) return state;
        
                const oldActiveId = ids[activeIndex];
                const newActiveId = ids[newIndex];
                
                const updatedMessages = { ...state.messages };
                const newAlternates = { ids, activeIndex: newIndex };
                ids.forEach(id => {
                    if (updatedMessages[id]) {
                        updatedMessages[id] = { ...updatedMessages[id], alternates: newAlternates };
                    }
                });
        
                const messageIds = [...session.messageIds];
                const idxToReplace = messageIds.indexOf(oldActiveId);
                
                if (idxToReplace !== -1) {
                    messageIds[idxToReplace] = newActiveId;
                } else {
                    logger.error("Could not find active alternate in session to replace.", { sessionId, oldActiveId });
                    for (const altId of ids) {
                        const idx = messageIds.indexOf(altId);
                        if (idx > -1) {
                            messageIds[idx] = newActiveId;
                            break;
                        }
                    }
                }
        
                return {
                    ...state,
                    messages: updatedMessages,
                    sessions: {
                        ...state.sessions,
                        [sessionId]: { ...session, messageIds },
                    },
                };
            });
        },

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
            
            set((state: ChatStore) => {
                const id = activeCharacterId!;
                return {
                    sessions: { ...state.sessions, [newSessionData.id]: newSessionData },
                    characterSessions: {
                        ...state.characterSessions,
                        [id]: [...(state.characterSessions[id] || []), newSessionData.id],
                    },
                };
            });

            useUIStore.getState().setActiveSessionId(newSessionData.id);
            return newSessionData.id;
        },

        deleteSession: (characterId: string, sessionId: string) => {
            set((state: ChatStore) => {
                const session = state.sessions[sessionId];
                if (!session) return state;
                const messagesToDelete = new Set(session.messageIds);
                
                // FIX: Use a robust immutable delete pattern.
                const newSessions = { ...state.sessions };
                // FIX: Removed redundant cast to string, as `sessionId` is already a string.
                delete newSessions[sessionId];
                
                const newMessages = { ...state.messages };
                messagesToDelete.forEach(id => delete newMessages[id]);

                let newCharacterSessions: Record<string, string[]>;
                // FIX: Added explicit type annotation to fix an inference issue where characterId was treated as 'unknown'.
                const characterSessions: Record<string, string[]> = state.characterSessions;
                const sessionsForChar = characterSessions[characterId];
                if (sessionsForChar) {
                    const updatedSessions = sessionsForChar.filter(sId => sId !== sessionId);
                    if (updatedSessions.length === 0) {
                        const rest = { ...characterSessions };
                        // FIX: Removed redundant cast to string.
                        delete rest[characterId];
                        newCharacterSessions = rest;
                    } else {
                        newCharacterSessions = {
                            ...characterSessions,
                            // FIX: Removed redundant cast to string.
                            [characterId]: updatedSessions,
                        };
                    }
                } else {
                    newCharacterSessions = characterSessions;
                }

                return {
                    sessions: newSessions,
                    messages: newMessages,
                    characterSessions: newCharacterSessions,
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
          
          let session: GroupSession | undefined, currentMessages: Message[] | undefined;
          set((state: ChatStore) => {
            session = state.groupSessions[activeGroupSessionId!] as GroupSession | undefined;
            if (!session) return state;
            const updatedMessages = { ...state.messages, [userMessage.id]: userMessage };
            currentMessages = [...session.messageIds, userMessage.id].map(id => updatedMessages[id]);
            const newGroupSessions = { ...state.groupSessions };
            newGroupSessions[activeGroupSessionId!] = { ...session, messageIds: [...session.messageIds, userMessage.id] };

            return {
              messages: updatedMessages,
              groupSessions: newGroupSessions
            };
          });
          
          const currentSession = get().groupSessions[activeGroupSessionId];
          if (!currentSession) {
            logger.log('Group session was deleted during message processing');
            return;
          }
        
          const { messages: processedMessages, summary: newSummary } = await handleSummarization(currentSession, currentMessages!);
          if (newSummary !== currentSession.memorySummary || processedMessages.length !== currentMessages!.length) {
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
            const messageToDelete = state.messages[messageId];
            if (!session || !messageToDelete) return state;

            const newMessages = { ...state.messages };
            const idsToDelete = new Set<string>();

            if (messageToDelete.alternates) {
                messageToDelete.alternates.ids.forEach(id => idsToDelete.add(id));
            } else {
                idsToDelete.add(messageId);
            }
            
            idsToDelete.forEach(id => delete newMessages[id]);

            const newMessageIds = session.messageIds.filter(id => !idsToDelete.has(id));

            return {
                messages: newMessages,
                groupSessions: { ...state.groupSessions, [sessionId]: { ...session, messageIds: newMessageIds } }
            };
          });
        },
        deleteMultipleGroupMessages: (sessionId, messageIds) => {
            set((state: ChatStore) => {
                const session = state.groupSessions[sessionId];
                if (!session) return state;

                const idsToDelete = new Set<string>();
                messageIds.forEach(id => {
                    const message = state.messages[id];
                    if (message) {
                        idsToDelete.add(id);
                        if (message.alternates) {
                            message.alternates.ids.forEach(altId => idsToDelete.add(altId));
                        }
                    }
                });

                const newMessages = { ...state.messages };
                idsToDelete.forEach(id => delete newMessages[id]);

                return {
                    messages: newMessages,
                    groupSessions: {
                        ...state.groupSessions,
                        [sessionId]: {
                            ...session,
                            messageIds: session.messageIds.filter(id => !idsToDelete.has(id)),
                        }
                    }
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
          // FIX: Replaced the destructuring assignment with a spread and delete pattern to immutably remove a property from the 'characterSessions' object. This avoids a TypeScript limitation with using dynamic keys in destructuring and resolves the 'Type 'unknown' cannot be used as an index type' error.
          // FIX: Added explicit type annotation for the `state` parameter to resolve TypeScript inference issues, fixing index-related errors.
          set((state: ChatStore) => {
            const sessionsForChar = state.characterSessions[characterId] || [];
            const sessionsToDelete = new Set(sessionsForChar);
            const messagesToDelete = new Set<string>();
        
            sessionsForChar.forEach(sessionId => {
              const session = state.sessions[sessionId];
              if (session) {
                session.messageIds.forEach(msgId => messagesToDelete.add(msgId));
              }
            });
        
            const groupSessionsToDelete = new Set<string>();
            // FIX: Removed redundant explicit type for `gs` as it's now correctly inferred from the typed `state`.
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
            
            // FIX: Re-introduced a cast that was incorrectly removed. This helps TypeScript's inference in this complex closure where the type of `characterId` was being lost.
            const characterSessions: Record<string, string[]> = state.characterSessions;
            const newCharSessions = { ...characterSessions };
            delete (newCharSessions as any)[characterId];
        
            return {
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
                    const newGroupSessions = { ...state.groupSessions };
                    newGroupSessions[sessionId] = { ...session, worldId };
                    return {
                        ...state,
                        groupSessions: newGroupSessions,
                    };
                } else {
                    const session = state.sessions[sessionId];
                    if (!session) return state;
                    const newSessions = { ...state.sessions };
                    newSessions[sessionId] = { ...session, worldId };
                    return {
                        ...state,
                        sessions: newSessions,
                    };
                }
            });
        },
        setSessionTemperature: (sessionId: string, temperature: number, isGroup: boolean = false) => {
            set((state: ChatStore) => {
                if (isGroup) {
                    const session = state.groupSessions[sessionId];
                    if (!session) return state;
                    const newGroupSessions = { ...state.groupSessions };
                    newGroupSessions[sessionId] = { ...session, temperature };
                    return {
                        ...state,
                        groupSessions: newGroupSessions,
                    };
                } else {
                    const session = state.sessions[sessionId];
                    if (!session) return state;
                    const newSessions = { ...state.sessions };
                    newSessions[sessionId] = { ...session, temperature };
                    return {
                        ...state,
                        sessions: newSessions,
                    };
                }
            });
        },
        setSessionContextSize: (sessionId: string, contextSize: number, isGroup: boolean = false) => {
            set((state: ChatStore) => {
                if (isGroup) {
                    const session = state.groupSessions[sessionId];
                    if (!session) return state;
                    const newGroupSessions = { ...state.groupSessions };
                    newGroupSessions[sessionId] = { ...session, contextSize };
                    return {
                        ...state,
                        groupSessions: newGroupSessions,
                    };
                } else {
                    const session = state.sessions[sessionId];
                    if (!session) return state;
                    const newSessions = { ...state.sessions };
                    newSessions[sessionId] = { ...session, contextSize };
                    return {
                        ...state,
                        sessions: newSessions,
                    };
                }
            });
        },
        setSessionMaxOutputTokens: (sessionId: string, maxOutputTokens: number, isGroup: boolean = false) => {
             set((state: ChatStore) => {
                if (isGroup) {
                    const session = state.groupSessions[sessionId];
                    if (!session) return state;
                    const newGroupSessions = { ...state.groupSessions };
                    newGroupSessions[sessionId] = { ...session, maxOutputTokens };
                    return {
                        ...state,
                        groupSessions: newGroupSessions,
                    };
                } else {
                    const session = state.sessions[sessionId];
                    if (!session) return state;
                    const newSessions = { ...state.sessions };
                    newSessions[sessionId] = { ...session, maxOutputTokens };
                    return {
                        ...state,
                        sessions: newSessions,
                    };
                }
            });
        },
        setSessionMemoryEnabled: (sessionId: string, enabled: boolean, isGroup: boolean = false) => {
            set((state: ChatStore) => {
                if (isGroup) {
                    const session = state.groupSessions[sessionId];
                    if (!session) return state;
                    const newGroupSessions = { ...state.groupSessions };
                    newGroupSessions[sessionId] = { ...session, memoryEnabled: enabled };
                    return {
                        ...state,
                        groupSessions: newGroupSessions,
                    };
                } else {
                    const session = state.sessions[sessionId];
                    if (!session) return state;
                    const newSessions = { ...state.sessions };
                    newSessions[sessionId] = { ...session, memoryEnabled: enabled };
                    return {
                        ...state,
                        sessions: newSessions,
                    };
                }
            });
        },
        
        exportChats: (sessionIds: string[], groupSessionIds: string[]) => {
            const { sessions, groupSessions, messages, characterSessions } = get();
            const { characters } = useCharacterStore.getState();
        
            const isSingleExport = sessionIds.length + groupSessionIds.length === 1;
            let filename = `roleplay_nexus_chats_${new Date().toISOString().split('T')[0]}.json`;
        
            const sessionsToExport = sessionIds.map(id => {
                const session = sessions[id];
                if (!session) return null;
                const characterId = Object.keys(characterSessions).find(charId => characterSessions[charId].includes(id));
                if (isSingleExport) {
                    const character = characters.find(c => c.id === characterId);
                    filename = `${character?.name || 'chat'}_export.json`;
                }
                return { ...session, characterId };
            }).filter((s): s is (Session & { characterId: string | undefined }) => s !== null);
        
            const groupSessionsToExport = groupSessionIds.map(id => {
                const session = groupSessions[id];
                if (isSingleExport && session) {
                    filename = `${session.title || 'group_chat'}_export.json`;
                }
                return session;
            }).filter(Boolean);
            
            const messageIds = new Set<string>();
            sessionsToExport.forEach(s => s.messageIds.forEach(id => messageIds.add(id)));
            groupSessionsToExport.forEach(s => s.messageIds.forEach(id => messageIds.add(id)));
        
            const messagesToExport = Array.from(messageIds).map(id => messages[id]).filter(Boolean);
        
            if (messagesToExport.length === 0 && sessionsToExport.length === 0 && groupSessionsToExport.length === 0) {
                alert("Selected chats have no messages to export.");
                return;
            }
        
            const exportData = {
                version: "1.0.0",
                exportedAt: new Date().toISOString(),
                sessions: sessionsToExport,
                groupSessions: groupSessionsToExport,
                messages: messagesToExport,
            };
        
            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },
        
        importChats: (jsonString: string) => {
            try {
                useUIStore.getState().requestConfirmation(
                    () => {
                        set((state: ChatStore) => {
                            const { sessions, groupSessions, messages, characterSessions } = state;
                            
                            const importedData = JSON.parse(jsonString);
                            if (importedData.version !== "1.0.0" || !importedData.sessions || !importedData.groupSessions || !importedData.messages) {
                                throw new Error("Invalid or unsupported chat export file.");
                            }
                
                            const newMessages = { ...messages };
                            const newSessions = { ...sessions };
                            const newGroupSessions = { ...groupSessions };
                            const newCharacterSessions = JSON.parse(JSON.stringify(characterSessions));
                
                            let importedSingleCount = 0;
                            let importedGroupCount = 0;
                
                            const messageIdMap = new Map<string, string>();
                            (importedData.messages as Message[]).forEach(msg => {
                                let newId = msg.id;
                                if (newMessages[newId]) { // ID conflict
                                    newId = crypto.randomUUID();
                                    messageIdMap.set(msg.id, newId);
                                }
                                newMessages[newId] = { ...msg, id: newId };
                            });
                
                            (importedData.sessions as (Session & {characterId?: string})[]).forEach(impSession => {
                                let newSessionId = impSession.id;
                                if (newSessions[newSessionId]) { // ID conflict
                                    newSessionId = crypto.randomUUID();
                                }
                
                                const newMessageIds = impSession.messageIds.map(oldId => messageIdMap.get(oldId) || oldId).filter(id => newMessages[id]);
                
                                const { characterId, ...sessionData } = impSession;
                                newSessions[newSessionId] = {
                                    ...sessionData,
                                    id: newSessionId,
                                    messageIds: newMessageIds
                                };
                                
                                const characterExists = useCharacterStore.getState().characters.some(c => c.id === characterId);
                
                                if (characterId && characterExists) {
                                    if (!newCharacterSessions[characterId]) {
                                        newCharacterSessions[characterId] = [];
                                    }
                                    if (!newCharacterSessions[characterId].includes(newSessionId)) {
                                        newCharacterSessions[characterId].push(newSessionId);
                                    }
                                } else if (characterId) {
                                    logger.log(`Imported session ${newSessionId} for a character (${characterId}) that does not exist. Session will be unlinked.`);
                                }
                                importedSingleCount++;
                            });
                
                            (importedData.groupSessions as GroupSession[]).forEach(impSession => {
                                let newSessionId = impSession.id;
                                if (newGroupSessions[newSessionId]) { // ID conflict
                                    newSessionId = crypto.randomUUID();
                                }
                                newGroupSessions[newSessionId] = {
                                    ...impSession,
                                    id: newSessionId,
                                    messageIds: impSession.messageIds.map(oldId => messageIdMap.get(oldId) || oldId).filter(id => newMessages[id]),
                                };
                                importedGroupCount++;
                            });
                            
                            setTimeout(() => alert(`${importedSingleCount} single chat(s) and ${importedGroupCount} group chat(s) imported successfully!`), 100);
                
                            return {
                                ...state,
                                messages: newMessages,
                                sessions: newSessions,
                                groupSessions: newGroupSessions,
                                characterSessions: newCharacterSessions,
                            };
                        });
                    },
                    "Import Chats",
                    "This will merge the imported chats with your existing history. Any chats with conflicting IDs will be assigned new IDs. Are you sure you want to continue?",
                    "Import",
                    'primary'
                );
        
            } catch (e) {
                alert(`Failed to import chats: ${e instanceof Error ? e.message : 'Unknown error'}`);
                logger.error("Chat import failed", e);
            }
        },
      };
    },
    {
      name: 'roleplay-nexus-chat',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);