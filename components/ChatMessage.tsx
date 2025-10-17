import React, { useRef, useEffect, useCallback } from 'react';
import { Message, Character, Persona, World } from '../types';
import { Icon } from './Icon';
import SimpleMarkdown from './SimpleMarkdown';
import Avatar from './Avatar';
import { SystemMessage, ActionButton } from './ChatCommon';
import ThinkingProcessDisplay from './ThinkingProcessDisplay';

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
  showThinking: boolean;
}

const ChatMessage = React.memo(function ChatMessage({
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
  showThinking,
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
          className={`p-4 rounded-2xl max-w-2xl lg:max-w-3xl relative ${
            isUser
              ? 'bg-slate-700 text-slate-100 rounded-tr-lg chat-bubble-right'
              : isError
              ? 'bg-red-500/20 text-red-300 rounded-tl-lg'
              : 'bg-slate-800 text-slate-200 rounded-tl-lg chat-bubble-left'
          }`}
        >
          {!isEditing && !message.isThinking && (
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
          ) : message.isThinking ? (
             showThinking && message.thinkingProcess && message.thinkingProcess.length > 0 ? (
                 <ThinkingProcessDisplay steps={message.thinkingProcess} />
             ) : (
                <div className="flex items-center gap-2 text-slate-400">
                    <Icon name="brain" className="w-4 h-4 animate-pulse" />
                    <span className="text-sm font-semibold">Thinking...</span>
                </div>
             )
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

export default ChatMessage;
