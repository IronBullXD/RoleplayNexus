import React, { useState, useRef, useCallback, ReactNode } from 'react';
import { Character, Message, Settings, LLMProvider, World, Persona, ChatSession, GroupChatSession } from '../../types';
import { getChatCompletionStream, generateCharacterProfile as generateProfile, summarizeMessages } from '../../services/llmService';
import { logger } from '../../services/logger';

const RENDER_INTERVAL = 100; // ms
const REASONING_TOKEN = '<|REASONING|>';
const MEMORY_TRIGGER_THRESHOLD = 0.75; // 75% of context size
const MEMORY_SLICE_PERCENT = 0.5; // Summarize oldest 50% of messages

const estimateTokens = (text: string): number => Math.ceil((text || '').length / 4);

/**
 * Safely extracts a user-friendly error message from an unknown error type.
 * It handles standard Error objects, objects with a 'message' property, and attempts
 * to parse JSON from string messages, which is common for API errors.
 * @param error The error caught in a catch block.
 * @returns A string representation of the error message.
 */
const extractErrorMessage = (error: unknown): string => {
    // 1. Handle standard Error objects
    if (error instanceof Error) {
        const rawMessage = error.message;

        // Attempt to parse JSON from the message (common in API errors from fetch)
        const jsonMatch = rawMessage.match(/({.*})/s);
        if (jsonMatch && jsonMatch[1]) {
            try {
                const errorJson = JSON.parse(jsonMatch[1]);
                // Look for nested message properties, a common pattern.
                let message = errorJson.error?.message || errorJson.message;
                // Sometimes the message is itself a JSON string
                 if (typeof message === 'string') {
                    try {
                        const nestedJson = JSON.parse(message);
                        message = nestedJson.error?.message || nestedJson.message || message;
                    } catch { /* Not nested JSON */ }
                }
                if (typeof message === 'string' && message.trim()) {
                    return `Service Error: ${message.trim()}`;
                }
            } catch { /* Fall through if JSON parsing fails */ }
        }
        // If no JSON or parsing fails, return the cleaned-up raw message
        return rawMessage.replace(/API request failed with status \d+:\s*/, '').trim() || rawMessage;
    }

    // 2. Handle non-Error objects that have a 'message' property
    if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
        return (error as { message: string }).message;
    }

    // 3. For other objects, try to stringify them to avoid '[object Object]'
    if (typeof error === 'object' && error !== null) {
        try {
            return `An unexpected error occurred: ${JSON.stringify(error)}`;
        } catch {
            // Fallback for objects that can't be stringified (e.g., circular references)
            return 'An unstringifiable error object was received.';
        }
    }
    
    // 4. Handle primitives and other types as a last resort
    return String(error);
};

interface UseChatLogicProps {
  settings: Settings;
  userPersona: Persona;
  worlds: World[];
  characters: Character[];
  activeCharacterId: string | null;
  activeSession: ChatSession | null;
  activeGroupSession: GroupChatSession | null;
  setConversations: React.Dispatch<React.SetStateAction<Record<string, ChatSession[]>>>;
  setGroupConversations: React.Dispatch<React.SetStateAction<Record<string, GroupChatSession>>>;
  requestConfirmation: (action: () => void, title: string, message: ReactNode, confirmText?: string, confirmVariant?: 'danger' | 'primary') => void;
}

export const useChatLogic = ({
  settings, userPersona, worlds, characters, activeCharacterId, activeSession, activeGroupSession,
  setConversations, setGroupConversations, requestConfirmation,
}: UseChatLogicProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
        logger.uiEvent('Stop generation requested by user');
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
    }
    if (isLoading) setIsLoading(false);
  }, [isLoading]);

  const handleSummarization = async (session: ChatSession | GroupChatSession, currentMessages: Message[]): Promise<{ messages: Message[], summary: string | undefined }> => {
    const contextSize = session.contextSize ?? settings.contextSize;
    if (!(session.memoryEnabled && contextSize > 0)) {
        return { messages: currentMessages, summary: session.memorySummary };
    }

    const totalTokens = estimateTokens(JSON.stringify(currentMessages));
    if (totalTokens < contextSize * MEMORY_TRIGGER_THRESHOLD) {
        return { messages: currentMessages, summary: session.memorySummary };
    }
    
    logger.log('Memory threshold reached, attempting summarization.', { totalTokens, contextSize });

    const sliceIndex = Math.floor(currentMessages.length * MEMORY_SLICE_PERCENT);
    const messagesToSummarize = currentMessages.slice(0, sliceIndex);
    const remainingMessages = currentMessages.slice(sliceIndex);

    try {
        const newSummary = await summarizeMessages({
            provider: settings.provider,
            apiKey: settings.apiKeys[settings.provider],
            model: settings.models?.[settings.provider] || '',
            messages: messagesToSummarize,
        });

        const updatedSummary = [session.memorySummary, newSummary].filter(Boolean).join('\n\n');
        const systemMessage: Message = { id: crypto.randomUUID(), role: 'system', content: '[System: The beginning of the conversation has been summarized to conserve memory.]', timestamp: Date.now() };
        
        return { messages: [systemMessage, ...remainingMessages], summary: updatedSummary };
    } catch (err) {
        logger.error('Auto-summarization failed.', { error: err });
        setError("Auto-summarization failed. Check API key and model settings.");
        return { messages: currentMessages, summary: session.memorySummary };
    }
  };

  const runChatCompletion = useCallback(async (character: Character, session: ChatSession, messages: Message[]) => {
    setIsLoading(true);
    setError(null);

    const { messages: processedMessages, summary: updatedSummary } = await handleSummarization(session, messages);
    setConversations(prev => ({
        ...prev, [character.id]: (prev[character.id] || []).map(s => s.id === session.id ? { ...s, messages: processedMessages, memorySummary: updatedSummary } : s)
    }));
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const aiMessageId = crypto.randomUUID();
    const prefill = settings.responsePrefill;
    const aiMessageShell: Message = { id: aiMessageId, role: 'assistant', content: '', timestamp: Date.now() };
    setConversations(prev => ({ ...prev, [character.id]: (prev[character.id] || []).map(s => s.id === session.id ? { ...s, messages: [...processedMessages, aiMessageShell] } : s) }));

    let fullResponse = '', fullReasoning = '', parsingReasoning = false;

    try {
      const apiKey = settings.apiKeys[settings.provider];
      if (settings.provider !== LLMProvider.GEMINI && !apiKey) throw new Error(`API key for ${settings.provider} is not set.`);
      
      const stream = getChatCompletionStream({
        provider: settings.provider, apiKey, model: settings.models?.[settings.provider] || '',
        messages: processedMessages, characterPersona: character.persona, userPersona, globalSystemPrompt: settings.systemPrompt,
        world: worlds.find(w => w.id === session.worldId), 
        temperature: session.temperature ?? settings.temperature,
        prefill, signal: controller.signal, 
        reasoningEnabled: session.reasoningEnabled ?? settings.reasoningEnabled,
        contextSize: session.contextSize ?? settings.contextSize, 
        maxOutputTokens: session.maxOutputTokens ?? settings.maxOutputTokens,
        memorySummary: updatedSummary,
      });

      let lastRenderTime = performance.now();
      for await (const chunk of stream) {
        if (controller.signal.aborted) throw new DOMException('The user aborted a request.', 'AbortError');
        
        let currentChunk = chunk;
        if (!parsingReasoning && currentChunk.includes(REASONING_TOKEN)) {
            const parts = currentChunk.split(REASONING_TOKEN);
            fullResponse += parts[0];
            parsingReasoning = true;
            fullReasoning += parts.slice(1).join(REASONING_TOKEN);
        } else if (parsingReasoning) {
            fullReasoning += currentChunk;
        } else {
            fullResponse += currentChunk;
        }

        if (performance.now() - lastRenderTime > RENDER_INTERVAL) {
            setConversations(prev => ({ ...prev, [character.id]: (prev[character.id] || []).map(s => s.id !== session.id ? s : { ...s, messages: s.messages.map(m => m.id === aiMessageId ? { ...m, content: fullResponse.trimStart() } : m) }) }));
            lastRenderTime = performance.now();
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') { 
          logger.log("Generation stopped by user."); 
      } else {
        const friendlyErrorMessage = extractErrorMessage(err);
        setError(friendlyErrorMessage);
        fullResponse = `Error: ${friendlyErrorMessage}`;
        logger.error('Chat completion failed', { error: err, friendlyMessage: friendlyErrorMessage });
      }
    } finally {
      setIsLoading(false);
      setConversations(prev => {
        const contentToSave = fullResponse.trim();
        return { ...prev, [character.id]: (prev[character.id] || []).map(s => s.id !== session.id ? s : { ...s, messages: s.messages.map(m => m.id === aiMessageId ? { ...m, content: contentToSave || (contentToSave === '' && fullReasoning.trim() ? '(No explicit response)' : ''), reasoning: fullReasoning.trim() || undefined } : m) }) };
      });
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  }, [settings, setConversations, worlds, userPersona]);
  
  const runGroupChatCompletion = useCallback(async (session: GroupChatSession, messages: Message[]) => {
    setIsLoading(true);
    setError(null);

    const { messages: processedMessages, summary: updatedSummary } = await handleSummarization(session, messages);
    setGroupConversations(prev => ({ ...prev, [session.id]: { ...(prev[session.id] || session), messages: processedMessages, memorySummary: updatedSummary } }));

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const aiMessageId = crypto.randomUUID();
    const aiMessageShell: Message = { id: aiMessageId, role: 'assistant', content: '', timestamp: Date.now() };
    setGroupConversations(prev => ({ ...prev, [session.id]: { ...(prev[session.id] || session), messages: [...processedMessages, aiMessageShell] } }));

    let fullResponse = '', fullReasoning = '', parsingReasoning = false;

    try {
        const apiKey = settings.apiKeys[settings.provider];
        if (settings.provider !== LLMProvider.GEMINI && !apiKey) throw new Error(`API key for ${settings.provider} is not set.`);
        const sessionCharacters = characters.filter(c => session.characterIds.includes(c.id));
        if (sessionCharacters.length === 0) throw new Error("No characters found for this group session.");

        const characterPersonas = sessionCharacters.map(c => `[${c.name}]:\n${c.persona}`).join('\n\n');
        const characterPrompt = `SCENARIO: ${session.scenario}\n\nCHARACTERS IN THIS SCENE:\n${characterPersonas}\n\nINSTRUCTIONS:\nYou will roleplay as the characters listed above. Your response must be from the perspective of the character who would most logically speak next. You MUST prefix every response with the speaking character's name in square brackets, exactly as it appears in the character list. For example: [Clara the Explorer]: *She dusts off her hat.* "Well, what have we here?". Do not add any other text outside this format.`;

        const stream = getChatCompletionStream({
            provider: settings.provider, apiKey, model: settings.models?.[settings.provider] || '', messages: processedMessages, characterPersona: characterPrompt, userPersona,
            globalSystemPrompt: settings.systemPrompt, 
            world: worlds.find(w => w.id === session.worldId),
            temperature: session.temperature ?? settings.temperature, 
            prefill: settings.responsePrefill, signal: controller.signal,
            reasoningEnabled: session.reasoningEnabled ?? settings.reasoningEnabled, 
            contextSize: session.contextSize ?? settings.contextSize,
            maxOutputTokens: session.maxOutputTokens ?? settings.maxOutputTokens,
            memorySummary: updatedSummary,
        });

        let lastRenderTime = performance.now();
        for await (const chunk of stream) {
            if (controller.signal.aborted) throw new DOMException('The user aborted a request.', 'AbortError');
            let currentChunk = chunk;
            if (!parsingReasoning && currentChunk.includes(REASONING_TOKEN)) {
                const parts = currentChunk.split(REASONING_TOKEN);
                fullResponse += parts[0];
                parsingReasoning = true;
                fullReasoning += parts.slice(1).join(REASONING_TOKEN);
            } else if (parsingReasoning) {
                fullReasoning += currentChunk;
            } else {
                fullResponse += chunk;
            }
            if (performance.now() - lastRenderTime > RENDER_INTERVAL) {
                setGroupConversations(prev => {
                    const currentSession = prev[session.id] || session;
                    const updatedMessages = currentSession.messages.map(m => m.id === aiMessageId ? { ...m, content: fullResponse.trimStart() } : m);
                    return { ...prev, [session.id]: { ...currentSession, messages: updatedMessages } };
                });
                lastRenderTime = performance.now();
            }
        }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') { 
          logger.log("Generation stopped by user."); 
      } else {
        const friendlyErrorMessage = extractErrorMessage(err);
        setError(friendlyErrorMessage);
        fullResponse = `Error: ${friendlyErrorMessage}`;
        logger.error('Group chat completion failed', { error: err, friendlyMessage: friendlyErrorMessage });
      }
    } finally {
        setIsLoading(false);
        const finalResponse = fullResponse.trim();
        const match = finalResponse.match(/^\[(.*?)\]:\s*(.*)$/s);
        let characterId;
        if (match) {
            const characterName = match[1];
            const speakingCharacter = characters.find(c => session.characterIds.includes(c.id) && c.name === characterName);
            characterId = speakingCharacter?.id;
        }
        setGroupConversations(prev => {
            const currentSession = prev[session.id] || session;
            const updatedMessages = currentSession.messages.map(m => m.id === aiMessageId ? { ...m, content: finalResponse, characterId, reasoning: fullReasoning.trim() || undefined } : m);
            return { ...prev, [session.id]: { ...currentSession, messages: updatedMessages } };
        });
        if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  }, [settings, characters, setGroupConversations, worlds, userPersona]);

  const sendMessage = useCallback(async (content: string) => {
    const character = characters.find(c => c.id === activeCharacterId);
    if (!character || !activeSession) return;
    logger.uiEvent('Sending single chat message', { characterId: character.id, length: content.length });
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content, timestamp: Date.now() };
    const updatedMessages = [...activeSession.messages, userMessage];
    await runChatCompletion(character, activeSession, updatedMessages);
  }, [activeCharacterId, characters, activeSession, runChatCompletion]);
  
  const sendGroupMessage = useCallback(async (content: string) => {
    if (!activeGroupSession) return;
    logger.uiEvent('Sending group chat message', { sessionId: activeGroupSession.id, length: content.length });
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content, timestamp: Date.now() };
    const updatedMessages = [...activeGroupSession.messages, userMessage];
    await runGroupChatCompletion(activeGroupSession, updatedMessages);
  }, [activeGroupSession, runGroupChatCompletion]);

  const regenerateResponse = useCallback(async () => {
    const character = characters.find(c => c.id === activeCharacterId);
    if (!character || !activeSession || isLoading) return;
    logger.uiEvent('Regenerating response', { characterId: character.id, sessionId: activeSession.id });
    const messagesToResend = activeSession.messages.slice(0, -1);
    if (messagesToResend.length === 0 || activeSession.messages[activeSession.messages.length-1].role !== 'assistant') return;
    await runChatCompletion(character, activeSession, messagesToResend);
  }, [activeCharacterId, characters, activeSession, isLoading, runChatCompletion]);

  const continueGeneration = useCallback(async () => {
    const character = characters.find(c => c.id === activeCharacterId);
    if (!character || !activeSession || activeSession.messages.length === 0 || isLoading) return;
    logger.uiEvent('Continuing generation', { characterId: character.id, sessionId: activeSession.id });
    await runChatCompletion(character, activeSession, activeSession.messages);
  }, [activeCharacterId, characters, activeSession, isLoading, runChatCompletion]);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    const character = characters.find(c => c.id === activeCharacterId);
    if (!character || !activeSession) return;
    logger.uiEvent('Editing message', { messageId });
    const messageIndex = activeSession.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    const messageToEdit = activeSession.messages[messageIndex];
    if (messageToEdit.role === 'user') {
        const updatedMessages = activeSession.messages.slice(0, messageIndex).concat({ ...messageToEdit, content: newContent, timestamp: Date.now() });
        await runChatCompletion(character, activeSession, updatedMessages);
    } else {
        setConversations(prev => ({ ...prev, [character.id]: (prev[character.id] || []).map(s => s.id !== activeSession.id ? s : { ...s, messages: s.messages.map(m => m.id === messageId ? { ...m, content: newContent } : m)})}));
    }
  }, [activeCharacterId, characters, activeSession, runChatCompletion, setConversations]);

  const deleteMessage = useCallback((messageId: string) => {
    if (!activeCharacterId || !activeSession) return;
    const messageToDelete = activeSession.messages.find(m => m.id === messageId);
    if (!messageToDelete) return;
    requestConfirmation(() => {
        logger.uiEvent('Deleting message', { messageId });
        setConversations(prev => ({ ...prev, [activeCharacterId]: (prev[activeCharacterId] || []).map(s => s.id !== activeSession.id ? s : { ...s, messages: s.messages.filter(m => m.id !== messageId)})}));
    }, 'Delete Message', `Are you sure you want to permanently delete this message?\n\n"${messageToDelete.content}"`, 'Delete', 'danger');
  }, [activeCharacterId, activeSession, requestConfirmation, setConversations]);
  
  const regenerateGroupResponse = useCallback(async () => {
    if (!activeGroupSession || isLoading) return;
    logger.uiEvent('Regenerating group response', { sessionId: activeGroupSession.id });
    const messagesToResend = activeGroupSession.messages.slice(0, -1);
    if (messagesToResend.length === 0 || activeGroupSession.messages[activeGroupSession.messages.length - 1].role !== 'assistant') return;
    await runGroupChatCompletion(activeGroupSession, messagesToResend);
  }, [activeGroupSession, isLoading, runGroupChatCompletion]);

  const continueGroupGeneration = useCallback(async () => {
    if (!activeGroupSession || activeGroupSession.messages.length === 0 || isLoading) return;
    logger.uiEvent('Continuing group generation', { sessionId: activeGroupSession.id });
    await runGroupChatCompletion(activeGroupSession, activeGroupSession.messages);
  }, [activeGroupSession, isLoading, runGroupChatCompletion]);
  
  const editGroupMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!activeGroupSession) return;
    logger.uiEvent('Editing group message', { messageId });
    const messageIndex = activeGroupSession.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    const messageToEdit = activeGroupSession.messages[messageIndex];
    if (messageToEdit.role === 'user') {
      const updatedMessages = activeGroupSession.messages.slice(0, messageIndex).concat({ ...messageToEdit, content: newContent, timestamp: Date.now() });
      await runGroupChatCompletion(activeGroupSession, updatedMessages);
    } else {
      setGroupConversations(prev => ({ ...prev, [activeGroupSession.id]: { ...activeGroupSession, messages: activeGroupSession.messages.map(m => m.id === messageId ? { ...m, content: newContent } : m) } }));
    }
  }, [activeGroupSession, runGroupChatCompletion, setGroupConversations]);

  const deleteGroupMessage = useCallback((messageId: string) => {
    if (!activeGroupSession) return;
    const messageToDelete = activeGroupSession.messages.find(m => m.id === messageId);
    if (!messageToDelete) return;
    requestConfirmation(() => {
      logger.uiEvent('Deleting group message', { messageId });
      setGroupConversations(prev => ({ ...prev, [activeGroupSession.id]: { ...activeGroupSession, messages: activeGroupSession.messages.filter(m => m.id !== messageId) } }));
    }, 'Delete Message', `Are you sure you want to permanently delete this message?\n\n"${messageToDelete.content}"`, 'Delete', 'danger');
  }, [activeGroupSession, requestConfirmation, setGroupConversations]);

  const generateCharacterProfile = useCallback(async (concept: string, currentSettings: Settings): Promise<Partial<Character>> => {
    const { provider, apiKeys, models } = currentSettings;
    const apiKey = apiKeys[provider]; const model = models?.[provider] || '';
    if (provider !== LLMProvider.GEMINI && !apiKey) throw new Error(`API key for ${provider} is not set.`);
    if (!model) throw new Error(`Model for ${provider} is not set.`);
    const profile = await generateProfile({ provider, apiKey, model, concept });
    return { name: profile.name, greeting: profile.greeting, description: profile.description, persona: profile.persona };
  }, []);

  return {
    isLoading,
    error,
    stopGeneration,
    sendMessage,
    editMessage,
    deleteMessage,
    regenerateResponse,
    continueGeneration,
    sendGroupMessage,
    editGroupMessage,
    deleteGroupMessage,
    regenerateGroupResponse,
    continueGroupGeneration,
    generateCharacterProfile,
  };
};
