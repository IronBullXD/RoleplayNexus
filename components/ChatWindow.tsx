import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { Character, Message, World, ChatSession, Persona } from '../types';
import { Icon, IconButton } from './Icon';
import SimpleMarkdown from './SimpleMarkdown';
import { logger } from '../services/logger';
import { useMessageEditing } from '../hooks/useMessageEditing';
import Avatar from './Avatar';
import ChatSettingsPopover from './ChatSettingsPopover';
import { useAppStore } from '../store/useAppStore';
import { Tooltip } from './Tooltip';
import { usePaginatedMessages } from '../hooks/usePaginatedMessages';
import {
  DateSeparator,
  SystemMessage,
  ActionButton,
  TypingIndicator,
} from './ChatCommon';

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

interface ChatMessageProps {
  message: Message;
  character: Character | null;
  userPersona: Persona | null;
  isLastMessage: boolean;
  isLoading: boolean;
  onDelete: (messageId: string) => void;
  onRegenerate: () => void;
  onFork: (messageId: string) => void;
  isEditing: boolean;
  editingText: string;
  onSetEditingText: (text: string) => void;
  onStartEdit: (message: Message) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  world: World | null;
}

function ChatMessage({
  message,
  character,
  userPersona,
  isLastMessage,
  isLoading,
  onDelete,
  onRegenerate,
  onFork,
  isEditing,
  editingText,
  onSetEditingText,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  world,
}: ChatMessageProps) {
  if (message.role === 'system') {
    return <SystemMessage message={message} />;
  }

  const isUser = message.role === 'user';
  const avatar = isUser ? userPersona?.avatar : character?.avatar;
  const isError = message.content.startsWith('Error:');
  const editTextAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && editTextAreaRef.current) {
      editTextAreaRef.current.focus();
      const el = editTextAreaRef.current;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [isEditing]);

  useEffect(() => {
    const el = editTextAreaRef.current;
    if (el && isEditing) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [editingText, isEditing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSaveEdit();
      }
      if (e.key === 'Escape') {
        onCancelEdit();
      }
    },
    [onSaveEdit, onCancelEdit],
  );

  return (
    <div
      className={`group flex items-start gap-3 my-5 animate-message-in ${
        isUser ? 'flex-row-reverse' : ''
      }`}
    >
      <Avatar
        src={avatar}
        alt="avatar"
        shape="square"
        className="w-10 h-10 mt-1"
      />
      <div
        className={`flex-1 min-w-0 flex ${
          isUser ? 'justify-end' : 'justify-start'
        }`}
      >
        <div
          className={`flex items-start gap-2 ${
            isUser ? 'flex-row-reverse' : ''
          }`}
        >
          <div
            className={`p-4 rounded-2xl max-w-2xl lg:max-w-3xl relative ${
              isUser
                ? 'bg-slate-700 text-slate-100 rounded-tr-lg chat-bubble-right'
                : isError
                ? 'bg-red-500/20 text-red-300 rounded-tl-lg'
                : 'bg-slate-800 text-slate-200 rounded-tl-lg chat-bubble-left'
            }`}
          >
            {isEditing ? (
              <div className="animate-fade-in" style={{ minWidth: '150px' }}>
                <div className="grid">
                  <div
                    aria-hidden="true"
                    className="invisible whitespace-pre-wrap break-words col-start-1 row-start-1 text-base leading-relaxed"
                  >
                    {editingText || ' '}
                    {'\u00A0'}
                  </div>
                  <textarea
                    ref={editTextAreaRef}
                    value={editingText}
                    onChange={(e) => onSetEditingText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className={`col-start-1 row-start-1 text-base bg-transparent border-0 focus:ring-0 resize-none w-full outline-none p-0 m-0 leading-relaxed ${
                      isUser ? 'text-slate-100' : 'text-slate-200'
                    }`}
                    rows={1}
                    spellCheck={false}
                  />
                </div>
                <div
                  className={`flex justify-end gap-2 items-center pt-2 mt-2 border-t ${
                    isUser ? 'border-slate-600' : 'border-slate-700/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      isUser
                        ? 'text-slate-300 bg-slate-600/50 hover:bg-slate-600'
                        : 'text-slate-300 bg-slate-700/50 hover:bg-slate-700'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onSaveEdit}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      isUser
                        ? 'text-white bg-crimson-600 hover:bg-crimson-500'
                        : 'text-white bg-crimson-600 hover:bg-crimson-500'
                    }`}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-base whitespace-pre-wrap leading-relaxed break-words">
                <SimpleMarkdown text={message.content} world={world} />
                {isLastMessage &&
                  isLoading &&
                  message.role === 'assistant' && (
                    <span className="inline-block w-1 h-4 bg-slate-400 ml-1 animate-pulse" />
                  )}
              </div>
            )}
          </div>

          {!isEditing && (
            <div className="flex flex-col items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pt-2 gap-1">
              <ActionButton
                icon="fork"
                label="Fork Chat"
                onClick={() => onFork(message.id)}
              />
              <ActionButton
                icon="delete"
                label="Delete Message"
                onClick={() => onDelete(message.id)}
              />
              <ActionButton
                icon="edit"
                label="Edit Message"
                onClick={() => onStartEdit(message)}
              />
              {!isUser && isLastMessage && (
                <ActionButton
                  icon="redo"
                  label="Regenerate"
                  onClick={onRegenerate}
                  disabled={isLoading}
                  className={isLoading ? 'animate-spin' : ''}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  const {
    activeCharacterId,
    characters,
    conversations,
    activeSessionId,
    userPersona,
    settings,
    worlds,
    resetChatView,
    newSession,
    setWorld,
    setTemperature,
    setContextSize,
    setMaxOutputTokens,
    setMemoryEnabled,
    deleteMessage,
    regenerateResponse,
    forkChat,
    editMessage,
    sendMessage,
    continueGeneration,
    stopGeneration,
  } = useAppStore();

  const character = useMemo(
    () => characters.find((c) => c.id === activeCharacterId),
    [characters, activeCharacterId],
  );
  const session = useMemo(
    () =>
      conversations[activeCharacterId || '']?.find(
        (s) => s.id === activeSessionId,
      ),
    [conversations, activeCharacterId, activeSessionId],
  );

  const activeWorld = useMemo(
    () => worlds.find((w) => w.id === session?.worldId),
    [worlds, session?.worldId],
  );

  const isLoading = useAppStore((state) => state.isLoading);
  const error = useAppStore((state) => state.error);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const {
    editingMessageId,
    editingText,
    setEditingText,
    startEditing,
    saveEdit,
    cancelEdit,
  } = useMessageEditing(editMessage);

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

  const messages = session?.messages || [];
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

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.max(
        56,
        Math.min(scrollHeight, 200),
      )}px`;
    }
  }, [input]);

  const handleAction = useCallback(() => {
    if (isLoading) return;
    if (input.trim()) {
      sendMessage(input.trim());
      setInput('');
    } else if (session?.messages.length) {
      continueGeneration();
    }
  }, [isLoading, input, session, sendMessage, continueGeneration]);

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleAction();
    },
    [handleAction],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleAction();
      }
    },
    [handleAction],
  );

  const lastMessageTimestamp = useMemo(() => {
    const lastMsg = session?.messages.filter((m) => m.role !== 'system').pop();
    return lastMsg?.timestamp;
  }, [session?.messages]);

  if (!character || !session) return null;

  const lastMessage = messages[messages.length - 1];
  const isReceiving = isLoading && lastMessage?.role === 'assistant';
  const showTypingIndicator = isLoading && !isReceiving;
  const canSubmit = !!input.trim();
  const canContinue =
    !canSubmit &&
    session.messages.length > 0 &&
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
          <IconButton icon="new-chat" label="New Chat" onClick={newSession} />
          <IconButton
            icon="history"
            label="Chat History"
            onClick={onNavigateToHistory}
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
            onSetWorld={setWorld}
            onSetTemperature={setTemperature}
            onSetContextSize={setContextSize}
            onSetMaxOutputTokens={setMaxOutputTokens}
            onSetMemoryEnabled={setMemoryEnabled}
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
                onClick={loadMore}
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
                onDelete={deleteMessage}
                onRegenerate={regenerateResponse}
                onFork={forkChat}
                isEditing={msg.id === editingMessageId}
                editingText={editingText}
                onSetEditingText={setEditingText}
                onStartEdit={startEditing}
                onSaveEdit={saveEdit}
                onCancelEdit={cancelEdit}
                world={msg.role === 'assistant' ? activeWorld : null}
              />
            </React.Fragment>
          ))}
          {showTypingIndicator && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="px-3 pb-3 pt-2 mt-auto">
        <div className="max-w-4xl w-full mx-auto">
          {error && (
            <p className="text-red-400 text-sm mb-2 text-center bg-red-900/50 border border-red-500/50 p-2 rounded-md">
              {error}
            </p>
          )}
          <form onSubmit={handleFormSubmit} className="relative w-full">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${character.name}...`}
              className="w-full bg-slate-950 border-2 border-slate-700 rounded-lg p-4 pr-20 resize-none outline-none text-base text-slate-100 placeholder-slate-600 focus:ring-2 focus:ring-crimson-500 focus:border-crimson-500 transition-all duration-200 custom-scrollbar min-h-[3.5rem]"
              rows={1}
              disabled={isLoading}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isLoading ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="w-10 h-10 flex items-center justify-center rounded-md bg-ember-600 text-white hover:bg-ember-500 transition-colors shadow-lg"
                  aria-label="Stop generation"
                >
                  <Icon name="stop" className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSubmit && !canContinue}
                  className="w-10 h-10 flex items-center justify-center rounded-md bg-crimson-600 text-white disabled:bg-slate-700 disabled:cursor-not-allowed hover:bg-crimson-500 transition-colors shadow-lg shadow-crimson-900/50"
                  aria-label={
                    canContinue ? 'Continue generation' : 'Send message'
                  }
                >
                  <Icon
                    name={canContinue ? 'ellipsis-horizontal' : 'send'}
                    className="w-5 h-5"
                  />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ChatWindow;
