import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import {
  Character,
  Message,
  World,
  ChatSession,
  Persona,
  WorldEntry,
} from '../types';
import { Icon, IconButton } from './Icon';
import { logger } from '../services/logger';
import { useMessageEditing } from '../hooks/useMessageEditing';
import Avatar from './Avatar';
import ChatSettingsPopover from './ChatSettingsPopover';
import { usePaginatedMessages } from '../hooks/usePaginatedMessages';
import { DateSeparator } from './ChatCommon';
import ChatMessageSkeleton from './ChatMessageSkeleton';
import { useUIStore } from '../store/stores/uiStore';
import { useCharacterStore } from '../store/stores/characterStore';
import { useChatStore } from '../store/stores/chatStore';
import { useSettingsStore } from '../store/stores/settingsStore';
import { useWorldStore } from '../store/stores/worldStore';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

interface ChatWindowProps {
  onNavigateToHistory: () => void;
}

const isSameDay = (ts1?: number, ts2?: number) => {
  if (!ts1 || !ts2) return true;
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

function formatRelativeTime(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const diffDays = Math.floor(diffSeconds / 86400);

  if (diffSeconds < 60) return 'Just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;

  const isSameYear = now.getFullYear() === date.getFullYear();

  if (diffDays === 1) return `Yesterday`;
  if (diffDays < 7)
    return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(
      date,
    );

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: isSameYear ? undefined : 'numeric',
  }).format(date);
}

function ChatWindow({ onNavigateToHistory }: ChatWindowProps) {
  // FIX: Moved `setActiveSessionId` from `useChatStore` to `useUIStore` where it is defined.
  const { activeCharacterId, activeSessionId, resetChatView, stopGeneration, setActiveSessionId } = useUIStore();
  const { isLoading, error } = useUIStore(state => ({ isLoading: state.isLoading, error: state.error }));
  
  const characters = useCharacterStore(state => state.characters);
  
  const { 
    sessions, 
    messages: allMessages, 
    newSession, 
    setSessionWorld, 
    setSessionTemperature, 
    setSessionContextSize, 
    setSessionMaxOutputTokens, 
    setSessionMemoryEnabled, 
    deleteMessage, 
    regenerateResponse, 
    forkChat, 
    editMessage, 
    sendMessage, 
    continueGeneration 
  } = useChatStore();

  const { userPersona, settings } = useSettingsStore();
  const worlds = useWorldStore(state => state.worlds);

  const character = useMemo(
    () => characters.find((c) => c.id === activeCharacterId),
    [characters, activeCharacterId],
  );
  const session = useMemo(
    () => (activeSessionId ? sessions[activeSessionId] : undefined),
    [sessions, activeSessionId],
  );

  const activeWorld = useMemo(
    () => worlds.find((w) => w.id === session?.worldId),
    [worlds, session?.worldId],
  );

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleEditMessage = useCallback((messageId: string, newContent: string) => {
    if (activeSessionId) {
      editMessage(activeSessionId, messageId, newContent);
    }
  }, [activeSessionId, editMessage]);

  const {
    editingMessageId,
    editingText,
    setEditingText,
    startEditing,
    saveEdit,
    cancelEdit,
  } = useMessageEditing(handleEditMessage);

  useEffect(() => {
    if (character)
      logger.uiEvent('ChatWindow mounted', {
        characterId: character.id,
        characterName: character.name,
      });
    return () => {
      if (character)
        logger.uiEvent('ChatWindow unmounted', {
          characterId: character.id,
          characterName: character.name,
        });
    };
  }, [character]);

  const messages = useMemo(() => {
    if (!session) return [];
    return (session.messageIds || []).map(id => allMessages[id]).filter(Boolean);
  }, [session, allMessages]);
  
  const { displayedMessages, hasMore, loadMore } = usePaginatedMessages(
    messages,
    scrollContainerRef,
  );

  const tokenCount = useMemo(
    () =>
      Math.ceil(
        messages.reduce((sum, msg) => sum + msg.content.length, 0) / 4,
      ),
    [messages],
  );

  useEffect(() => {
    if (!isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isLoading]);

  const handleAction = useCallback(() => {
    if (isLoading) return;
    if (input.trim()) {
      sendMessage(input.trim());
      setInput('');
    } else if (messages.length && activeSessionId) {
      continueGeneration(activeSessionId);
    }
  }, [isLoading, input, messages, activeSessionId, sendMessage, continueGeneration]);

  const lastMessageTimestamp = useMemo(() => {
    const lastMsg = messages.filter((m) => m.role !== 'system').pop();
    return lastMsg?.timestamp;
  }, [messages]);

  const handleNewChat = useCallback(() => {
    if (character?.id) {
      const newSessionId = newSession(character.id);
      if (newSessionId) {
        setActiveSessionId(newSessionId);
      }
    }
  }, [character, newSession, setActiveSessionId]);
  
  const handleDelete = useCallback((messageId: string) => {
    if (activeSessionId) deleteMessage(activeSessionId, messageId);
  }, [activeSessionId, deleteMessage]);
  
  const handleRegenerate = useCallback(() => {
    if (activeSessionId) regenerateResponse(activeSessionId);
  }, [activeSessionId, regenerateResponse]);
  
  const handleFork = useCallback((messageId: string) => {
    if (activeSessionId) forkChat(activeSessionId, messageId);
  }, [activeSessionId, forkChat]);

  if (!character || !session) return null;

  const lastMessage = messages[messages.length - 1];
  const isReceiving = isLoading && lastMessage?.role === 'assistant';
  const showTypingIndicator = isLoading && !isReceiving && !lastMessage?.isThinking;
  const canSubmit = !!input.trim();
  const canContinue =
    !canSubmit &&
    messages.length > 0 &&
    lastMessage?.role === 'assistant';

  return (
    <div className="flex-1 flex flex-col bg-transparent h-screen">
      <header className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-950/70 backdrop-blur-sm z-10 shrink-0 shadow-lg">
        <div className="flex items-center gap-1 shrink-0">
          <IconButton
            icon="arrow-left"
            label="Back to Characters"
            onClick={resetChatView}
          />
        </div>

        <div className="flex-1 flex justify-center items-center gap-4 overflow-hidden min-w-0 mx-4">
          <Avatar
            src={character.avatar}
            alt={character.name}
            shape="square"
            className="w-12 h-12 border-2 border-slate-950"
          />
          <div className="flex flex-col items-start overflow-hidden min-w-0">
            <h2 className="font-display text-lg leading-tight truncate uppercase tracking-wider">
              {character.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono shrink-0">
              <span>{tokenCount} tokens</span>
              {lastMessageTimestamp && (
                <>
                  <span className="text-slate-700">|</span>
                  <span>{formatRelativeTime(lastMessageTimestamp)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <IconButton icon="new-chat" label="New Chat" onClick={handleNewChat} />
          <IconButton
            icon="history"
            label="Chat History"
            onClick={() => onNavigateToHistory()}
          />
          <ChatSettingsPopover
            settings={{
              worldId: session.worldId ?? null,
              temperature: session.temperature ?? settings.temperature,
              contextSize: session.contextSize ?? settings.contextSize,
              maxOutputTokens:
                session.maxOutputTokens ?? settings.maxOutputTokens,
              memoryEnabled: session.memoryEnabled ?? false,
            }}
            worlds={worlds}
            onSetWorld={(worldId) => activeSessionId && setSessionWorld(activeSessionId, worldId, false)}
            onSetTemperature={(temp) => activeSessionId && setSessionTemperature(activeSessionId, temp, false)}
            onSetContextSize={(size) => activeSessionId && setSessionContextSize(activeSessionId, size, false)}
            onSetMaxOutputTokens={(tokens) => activeSessionId && setSessionMaxOutputTokens(activeSessionId, tokens, false)}
            onSetMemoryEnabled={(enabled) => activeSessionId && setSessionMemoryEnabled(activeSessionId, enabled, false)}
          />
        </div>
      </header>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar"
      >
        <div className="max-w-4xl w-full mx-auto px-4 md:px-5">
          {hasMore && (
            <div className="text-center my-4 animate-fade-in">
              <button
                onClick={() => loadMore()}
                className="px-4 py-2 text-sm font-semibold text-crimson-300 bg-crimson-900/50 border border-crimson-700/70 rounded-full hover:bg-crimson-800/50 transition-colors shadow-inner shadow-crimson-900/50"
              >
                Show Older Messages
              </button>
            </div>
          )}
          {displayedMessages.map((msg, index) => (
            <React.Fragment key={msg.id}>
              {(index === 0 ||
                !isSameDay(
                  displayedMessages[index - 1].timestamp,
                  msg.timestamp,
                )) &&
                msg.timestamp && <DateSeparator timestamp={msg.timestamp} />}
              <ChatMessage
                message={msg}
                character={character}
                userPersona={userPersona}
                isLastMessage={msg.id === lastMessage?.id}
                isLoading={isLoading}
                onDelete={handleDelete}
                onRegenerate={handleRegenerate}
                onFork={handleFork}
                isEditing={msg.id === editingMessageId}
                editingText={editingText}
                onSetEditingText={setEditingText}
                onStartEdit={startEditing}
                onSaveEdit={saveEdit}
                onCancelEdit={cancelEdit}
                world={msg.role === 'assistant' ? activeWorld : null}
                showThinking={settings.showThinking}
              />
            </React.Fragment>
          ))}
          {showTypingIndicator && <ChatMessageSkeleton />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <ChatInput
        input={input}
        setInput={setInput}
        handleAction={handleAction}
        isLoading={isLoading}
        error={error}
        stopGeneration={stopGeneration}
        characterName={character.name}
        canSubmit={canSubmit}
        canContinue={canContinue}
      />
    </div>
  );
}

export default ChatWindow;