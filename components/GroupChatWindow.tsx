import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { Character, Message, World, Persona } from '../types';
import { Icon, IconButton } from './Icon';
import SimpleMarkdown from './SimpleMarkdown';
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
} from './ChatCommon';
import ChatMessageSkeleton from './ChatMessageSkeleton';

interface GroupChatWindowProps {
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

interface EditableGroupChatMessageProps {
  message: Message;
  characterMap: Map<string, Character>;
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

const EditableGroupChatMessage = React.memo(function EditableGroupChatMessage({
  message,
  characterMap,
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
}: EditableGroupChatMessageProps) {
  if (message.role === 'system') {
    return <SystemMessage message={message} />;
  }

  const isUser = message.role === 'user';
  const speakingCharacter =
    !isUser && message.characterId
      ? characterMap.get(message.characterId)
      : null;
  const avatar = isUser ? userPersona?.avatar : speakingCharacter?.avatar;
  const name = speakingCharacter?.name;
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
        alt={name || 'User'}
        shape="square"
        className="w-10 h-10 mt-1"
      />
      <div
        className={`flex-1 min-w-0 flex flex-col ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        {!isUser && name && (
          <p className="text-sm text-slate-400 mb-1 ml-3 font-semibold">
            {name}
          </p>
        )}
        <div
          className={`p-4 rounded-2xl max-w-2xl lg:max-w-3xl relative ${
            isUser
              ? 'bg-slate-700 text-white rounded-tr-lg chat-bubble-right'
              : 'bg-slate-800 text-slate-200 rounded-tl-lg chat-bubble-left'
          }`}
        >
          {!isEditing && (
            <div
              className={`absolute flex items-center gap-0.5 p-1 bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
                isUser ? 'left-4 -top-4' : 'right-4 -top-4'
              }`}
            >
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
                    isUser ? 'text-white' : 'text-slate-200'
                  }`}
                  rows={1}
                  spellCheck={false}
                />
              </div>
              <div
                className={`flex justify-end gap-2 items-center pt-2 mt-2 border-t ${
                  isUser ? 'border-white/20' : 'border-slate-700/50'
                }`}
              >
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    isUser
                      ? 'text-white bg-white/10 hover:bg-white/20'
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
                      ? 'text-crimson-600 bg-white hover:bg-slate-200'
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
              {isLastMessage && isLoading && message.role === 'assistant' && (
                <span className="inline-block w-1 h-4 bg-slate-400 ml-1 animate-pulse" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

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

function GroupChatWindow({ onNavigateToHistory }: GroupChatWindowProps) {
  const {
    activeGroupSessionId,
    groupSessions,
    messages: allMessages,
    characters,
    userPersona,
    settings,
    worlds,
    setCurrentView,
    setSessionWorld,
    setSessionTemperature,
    setSessionContextSize,
    setSessionMaxOutputTokens,
    setSessionMemoryEnabled,
    editGroupMessage,
    deleteGroupMessage,
    regenerateGroupResponse,
    forkGroupChat,
    sendGroupMessage,
    continueGroupGeneration,
    stopGeneration,
  } = useAppStore();

  const session = useMemo(
    () => (activeGroupSessionId ? groupSessions[activeGroupSessionId] : null),
    [groupSessions, activeGroupSessionId],
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

  const handleEditMessage = useCallback((messageId: string, newContent: string) => {
    if (activeGroupSessionId) {
      editGroupMessage(activeGroupSessionId, messageId, newContent);
    }
  }, [activeGroupSessionId, editGroupMessage]);

  const {
    editingMessageId,
    editingText,
    setEditingText,
    startEditing,
    saveEdit,
    cancelEdit,
  } = useMessageEditing(handleEditMessage);

  const messages = useMemo(() => {
    if (!session) return [];
    return (session.messageIds || []).map(id => allMessages[id]).filter(Boolean);
  }, [session, allMessages]);

  const { displayedMessages, hasMore, loadMore } = usePaginatedMessages(
    messages,
    scrollContainerRef,
  );

  const characterMap: Map<string, Character> = useMemo(
    () => new Map(characters.map((c) => [c.id, c])),
    [characters],
  );
  const tokenCount = useMemo(
    () =>
      Math.ceil(
        messages.reduce(
          (sum, msg) => sum + msg.content.length,
          0,
        ) / 4,
      ),
    [messages],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCurrentView('CHARACTER_SELECTION');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCurrentView]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, isLoading]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(
        56,
        Math.min(textareaRef.current.scrollHeight, 160),
      )}px`;
    }
  }, [input]);

  const handleAction = useCallback(() => {
    if (isLoading) return;
    if (input.trim()) {
      sendGroupMessage(input.trim());
      setInput('');
    } else if (messages.length > 0 && activeGroupSessionId) {
      // FIX: Pass the activeGroupSessionId to continueGroupGeneration to resolve argument mismatch.
      continueGroupGeneration(activeGroupSessionId);
    }
  }, [isLoading, input, messages, activeGroupSessionId, sendGroupMessage, continueGroupGeneration]);

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
    const lastMsg = messages.filter((m) => m.role !== 'system').pop();
    return lastMsg?.timestamp;
  }, [messages]);

  if (!session) return null;

  const sessionCharacters = characters.filter((c) =>
    session.characterIds.includes(c.id),
  );
  const avatarSlice = sessionCharacters.slice(0, 3);
  const lastMessage = messages[messages.length - 1];
  const isReceiving = isLoading && lastMessage?.role === 'assistant';
  const showTypingIndicator = isLoading && !isReceiving;
  const canSubmit = !!input.trim();
  const canContinue = !canSubmit && messages.length > 0;

  return (
    <div className="flex-1 flex flex-col bg-transparent h-screen">
      <header className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-950/70 backdrop-blur-sm z-10 shrink-0 shadow-lg">
        <div className="flex items-center gap-1 shrink-0">
          <IconButton
            icon="arrow-left"
            label="Back (Esc)"
            onClick={() => setCurrentView('CHARACTER_SELECTION')}
          />
        </div>

        <div className="flex-1 flex justify-center items-center gap-3 overflow-hidden min-w-0 mx-4">
          <div className="flex -space-x-5 shrink-0">
            {avatarSlice.map((char) => (
              <Avatar
                key={char.id}
                src={char.avatar}
                alt={char.name}
                shape="square"
                className="w-10 h-10 border-2 border-slate-950"
              />
            ))}
          </div>
          <div className="flex flex-col items-start overflow-hidden min-w-0">
            <h2 className="font-display text-lg leading-tight truncate uppercase tracking-wider">
              {session.title}
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
            onSetWorld={(worldId) => activeGroupSessionId && setSessionWorld(activeGroupSessionId, worldId, true)}
            onSetTemperature={(temp) => activeGroupSessionId && setSessionTemperature(activeGroupSessionId, temp, true)}
            onSetContextSize={(size) => activeGroupSessionId && setSessionContextSize(activeGroupSessionId, size, true)}
            onSetMaxOutputTokens={(tokens) => activeGroupSessionId && setSessionMaxOutputTokens(activeGroupSessionId, tokens, true)}
            onSetMemoryEnabled={(enabled) => activeGroupSessionId && setSessionMemoryEnabled(activeGroupSessionId, enabled, true)}
          />
        </div>
      </header>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar"
      >
        <div className="max-w-4xl w-full mx-auto px-4 md:px-5">
          <div className="my-6 p-5 bg-slate-800/50 rounded-lg border border-slate-700 flex gap-4 items-start">
            <Icon
              name="book-open"
              className="w-6 h-6 text-slate-400 shrink-0 mt-1"
            />
            <div>
              <h3 className="font-bold text-slate-200 font-display tracking-wider">
                SCENARIO
              </h3>
              <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap">
                {session.scenario}
              </p>
            </div>
          </div>
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
              <EditableGroupChatMessage
                message={msg}
                characterMap={characterMap}
                userPersona={userPersona}
                isLastMessage={msg.id === lastMessage?.id}
                isLoading={isLoading}
                onDelete={(messageId) => activeGroupSessionId && deleteGroupMessage(activeGroupSessionId, messageId)}
                // FIX: Pass the activeGroupSessionId to regenerateGroupResponse to resolve argument mismatch.
                onRegenerate={() => activeGroupSessionId && regenerateGroupResponse(activeGroupSessionId)}
                onFork={(messageId) => activeGroupSessionId && forkGroupChat(activeGroupSessionId, messageId)}
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
          {showTypingIndicator && <ChatMessageSkeleton />}
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
              placeholder="Send a message to the group..."
              className="w-full bg-slate-950 border-2 border-slate-700 rounded-lg p-4 pr-20 resize-none outline-none text-base text-slate-100 placeholder-slate-600 focus:ring-2 focus:ring-crimson-500 focus:border-crimson-500 transition-all duration-200 custom-scrollbar min-h-[3.5rem]"
              rows={1}
              disabled={isLoading}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isLoading ? (
                <button
                  type="button"
                  onClick={() => stopGeneration()}
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

export default GroupChatWindow;