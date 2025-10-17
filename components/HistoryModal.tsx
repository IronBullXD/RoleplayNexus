import React, { useState, useMemo, useEffect } from 'react';
import { Character, ChatSession, GroupChatSession, Message } from '../types';
import { Icon } from './Icon';
import Avatar from './Avatar';
import { useCharacterStore } from '../store/stores/characterStore';
import { useChatStore, GroupSession, Session } from '../store/stores/chatStore';
import { motion } from 'framer-motion';
import { useUIStore } from '../store/stores/uiStore';

interface HistoryModalProps {
  onClose: () => void;
}

interface HistoryItemProps {
  avatars: (string | undefined)[];
  title: string;
  subtitle: string;
  lastMessage: string;
  lastMessageTimestamp?: number;
  onSelect: () => void;
  onDelete: () => void;
}

const HistoryItem: React.FC<HistoryItemProps> = ({
  avatars,
  title,
  subtitle,
  lastMessage,
  lastMessageTimestamp,
  onSelect,
  onDelete,
}) => {
  return (
    <div className="w-full flex items-center gap-2 p-2 pr-4 bg-slate-900/50 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-800/50 rounded-lg transition-all group">
      <button
        onClick={onSelect}
        className="flex-1 flex items-start gap-4 overflow-hidden text-left p-2"
      >
        <div className="flex -space-x-5 shrink-0">
          {avatars
            .slice(0, 3)
            .map((avatar, i) => (
              <Avatar
                key={i}
                src={avatar}
                alt=""
                shape="circle"
                className="w-12 h-12 border-2 border-slate-900"
              />
            ))}
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex justify-between items-baseline">
            <h2 className="font-bold text-slate-100 truncate">{title}</h2>
            {lastMessageTimestamp && (
              <p className="text-xs text-slate-500 shrink-0 ml-4 font-mono">
                {new Date(lastMessageTimestamp).toLocaleDateString()}
              </p>
            )}
          </div>
          <p className="text-sm text-slate-400 truncate mt-1">
            <span className="font-medium">{subtitle}</span> -{' '}
            {lastMessage || 'No messages yet.'}
          </p>
        </div>
      </button>
      <button
        onClick={onDelete}
        className="p-2 text-slate-500 hover:text-fuchsia-500 hover:bg-slate-700/50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        aria-label={`Delete chat: ${title}`}
      >
        <Icon name="delete" className="w-5 h-5" />
      </button>
    </div>
  );
};

function HistoryModal({ onClose }: HistoryModalProps) {
  const { characters } = useCharacterStore();
  const {
    sessions,
    characterSessions,
    groupSessions,
    messages: allMessages,
    deleteSession,
    deleteGroupSession,
  } = useChatStore();
  const { setCurrentView, setActiveCharacterId, setActiveSessionId, setActiveGroupSessionId } = useUIStore();
  const [activeTab, setActiveTab] = useState<'single' | 'group'>('single');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const singleChatSessions = useMemo(
    () =>
      // FIX: Add explicit type assertion for `characterSessions` to resolve 'unknown' type error from persisted state.
      Object.entries(characterSessions as Record<string, string[]>)
        .flatMap(([charId, sessionIds]: [string, string[]]) => {
            return sessionIds.map(sessionId => {
                const session: Session | undefined = sessions[sessionId];
                if (!session) return null;
                const lastMessage = (session.messageIds || []).length > 0 ? allMessages[session.messageIds[session.messageIds.length - 1]] : null;
                return {
                    charId,
                    session,
                    lastMessageTimestamp: lastMessage?.timestamp || 0,
                };
            }).filter((s): s is NonNullable<typeof s> => s !== null);
        })
        .sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp),
    [characterSessions, sessions, allMessages],
  );

  const groupChatSessions = useMemo(
    () =>
      Object.values(groupSessions)
        .map((session: GroupSession) => {
            const lastMessage = (session.messageIds || []).length > 0 ? allMessages[session.messageIds[session.messageIds.length - 1]] : null;
            return {
                session,
                lastMessageTimestamp: lastMessage?.timestamp || 0,
            };
        })
        .sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp),
    [groupSessions, allMessages],
  );

  const handleSelectSession = (characterId: string, sessionId: string) => {
    setActiveCharacterId(characterId);
    setActiveSessionId(sessionId);
    setCurrentView('CHAT');
    onClose();
  };

  const handleSelectGroupSession = (sessionId: string) => {
    setActiveGroupSessionId(sessionId);
    setCurrentView('GROUP_CHAT');
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-modal-title"
        className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl flex flex-col border border-slate-700 h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <h2 id="history-modal-title" className="text-xl font-bold font-display tracking-widest uppercase">
            Chat History
          </h2>
          <button
            onClick={onClose}
            aria-label="Close history"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md"
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="p-2 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('single')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                activeTab === 'single'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Single Chats
            </button>
            <button
              onClick={() => setActiveTab('group')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                activeTab === 'group'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Group Chats
            </button>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          {activeTab === 'single' ? (
            <div className="space-y-3">
              {singleChatSessions.length > 0 ? (
                singleChatSessions.map(({ session, charId }) => {
                  const character = characters.find((c) => c.id === charId);
                  if (!character) return null;
                  const lastMessage = session.messageIds.length > 0 ? allMessages[session.messageIds[session.messageIds.length - 1]] : null;
                  return (
                    <HistoryItem
                      key={session.id}
                      avatars={[character.avatar]}
                      title={character.name}
                      subtitle={session.title}
                      lastMessage={lastMessage?.content || ''}
                      lastMessageTimestamp={lastMessage?.timestamp}
                      onSelect={() => handleSelectSession(charId, session.id)}
                      onDelete={() => deleteSession(charId, session.id)}
                    />
                  );
                })
              ) : (
                <p className="text-center text-slate-500 pt-8">
                  No single chat history found.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {groupChatSessions.length > 0 ? (
                groupChatSessions.map(({ session }) => {
                  const sessionCharacters = session.characterIds
                    .map((id) => characters.find((c) => c.id === id))
                    .filter((c): c is Character => !!c);
                  const lastMessage =
                    session.messageIds.length > 0 ? allMessages[session.messageIds[session.messageIds.length - 1]] : null;
                  return (
                    <HistoryItem
                      key={session.id}
                      avatars={sessionCharacters.map((c) => c.avatar)}
                      title={session.title}
                      subtitle="Group Chat"
                      lastMessage={lastMessage?.content || ''}
                      lastMessageTimestamp={lastMessage?.timestamp}
                      onSelect={() => handleSelectGroupSession(session.id)}
                      onDelete={() => deleteGroupSession(session.id)}
                    />
                  );
                })
              ) : (
                <p className="text-center text-slate-500 pt-8">
                  No group chat history found.
                </p>
              )}
            </div>
          )}
        </main>
      </motion.div>
    </motion.div>
  );
}

export default HistoryModal;