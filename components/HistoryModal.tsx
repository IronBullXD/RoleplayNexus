import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Character, ChatSession, GroupChatSession, Message } from '../types';
import { Icon } from './Icon';
import Avatar from './Avatar';
import { useCharacterStore } from '../store/stores/characterStore';
import { useChatStore, GroupSession, Session } from '../store/stores/chatStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../store/stores/uiStore';

interface HistoryModalProps {
  onClose: () => void;
}

const CustomCheckbox: React.FC<{
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement> | React.MouseEvent) => void;
  indeterminate?: boolean;
  id: string;
  label?: string;
}> = ({ checked, onChange, indeterminate = false, id, label }) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-5 h-5 flex items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
          className="appearance-none w-5 h-5 border-2 border-slate-600 rounded-md checked:bg-crimson-500 checked:border-crimson-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-crimson-500 transition-colors cursor-pointer"
        />
        {checked && !indeterminate && (
          <Icon
            name="checkmark"
            className="w-4 h-4 text-white absolute pointer-events-none"
          />
        )}
        {indeterminate && (
          <div className="w-2.5 h-1 bg-crimson-500 rounded-sm absolute pointer-events-none" />
        )}
      </div>
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-slate-300 cursor-pointer"
        >
          {label}
        </label>
      )}
    </div>
  );
};


interface HistoryItemProps {
  avatars: (string | undefined)[];
  title: string;
  subtitle: string;
  lastMessage: string;
  lastMessageTimestamp?: number;
  onSelect: () => void;
  onDelete: () => void;
  onExport: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
}

const HistoryItem: React.FC<HistoryItemProps> = ({
  avatars,
  title,
  subtitle,
  lastMessage,
  lastMessageTimestamp,
  onSelect,
  onDelete,
  onExport,
  isSelected,
  onToggleSelect,
}) => {
  return (
    <div
      onClick={onToggleSelect}
      className={`w-full flex items-center gap-2 p-2 pr-4 bg-slate-900/50 border hover:bg-slate-800/50 rounded-lg transition-all group cursor-pointer ${
        isSelected
          ? 'border-crimson-500/80 bg-slate-800/50'
          : 'border-slate-800 hover:border-sky-500/50'
      }`}
    >
      <div className="flex items-center pl-2" onClick={(e) => e.stopPropagation()}>
        <CustomCheckbox
          id={`select-history-${title}-${subtitle}`}
          checked={isSelected}
          onChange={onToggleSelect}
        />
      </div>
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
      <div
        className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onExport}
          className="p-2 text-slate-500 hover:text-sky-400 hover:bg-slate-700/50 rounded-md"
          aria-label={`Export chat: ${title}`}
        >
          <Icon name="export" className="w-5 h-5" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-slate-500 hover:text-ember-500 hover:bg-slate-700/50 rounded-md"
          aria-label={`Delete chat: ${title}`}
        >
          <Icon name="delete" className="w-5 h-5" />
        </button>
      </div>
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
    exportChats,
    importChats,
  } = useChatStore();
  const { requestConfirmation, setCurrentView, setActiveCharacterId, setActiveSessionId, setActiveGroupSessionId } = useUIStore();
  const [activeTab, setActiveTab] = useState<'single' | 'group'>('single');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    // Clear selection when tab changes
    setSelectedIds(new Set());
  }, [activeTab]);


  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (e.target?.result) {
            importChats(e.target.result as string);
          }
        } catch (error) {
          alert('Failed to parse chat file.');
        }
      };
      reader.readAsText(file);
      if (event.target) event.target.value = ''; // Reset file input
    }
  };

  const handleExportAll = () => {
    const allSessionIds = Object.keys(sessions);
    const allGroupSessionIds = Object.keys(groupSessions);
    if (allSessionIds.length === 0 && allGroupSessionIds.length === 0) {
      alert('No chats to export.');
      return;
    }
    exportChats(allSessionIds, allGroupSessionIds);
  };

  const singleChatSessions = useMemo(
    () =>
      Object.entries(characterSessions || {})
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
      Object.values(groupSessions || {})
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

  const displayedItems = useMemo(() => {
    return activeTab === 'single'
      ? singleChatSessions.map(s => ({ id: s.session.id, ...s }))
      : groupChatSessions.map(s => ({ id: s.session.id, ...s }));
  }, [activeTab, singleChatSessions, groupChatSessions]);

  const handleToggleSelection = (id: string) => {
    setSelectedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  };

  const handleToggleSelectAll = () => {
      if (selectedIds.size === displayedItems.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(displayedItems.map(item => item.id)));
      }
  };

  const handleDeleteSelected = () => {
    requestConfirmation(
        () => {
            selectedIds.forEach(id => {
                if (activeTab === 'single') {
                    const sessionData = singleChatSessions.find(s => s.session.id === id);
                    if (sessionData) deleteSession(sessionData.charId, id);
                } else {
                    deleteGroupSession(id);
                }
            });
            setSelectedIds(new Set());
        },
        'Delete Selected Chats',
        `Are you sure you want to permanently delete ${selectedIds.size} selected chat(s)? This action cannot be undone.`,
        'Delete',
        'danger'
    );
  };

  const handleExportSelected = () => {
    if (selectedIds.size === 0) return;
    if (activeTab === 'single') {
        exportChats(Array.from(selectedIds), []);
    } else {
        exportChats([], Array.from(selectedIds));
    }
  };

  const allSelected = displayedItems.length > 0 && selectedIds.size === displayedItems.length;
  const isIndeterminate = selectedIds.size > 0 && !allSelected;

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
          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept=".json" />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 hover:bg-slate-700 rounded-md transition-colors border border-slate-600"><Icon name="import" className="w-4 h-4" /> Import Chats</button>
            <button onClick={handleExportAll} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 hover:bg-slate-700 rounded-md transition-colors border border-slate-600"><Icon name="export" className="w-4 h-4" /> Export All</button>
            <button
              onClick={onClose}
              aria-label="Close history"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md ml-4"
            >
              <Icon name="close" />
            </button>
          </div>
        </header>

        <div className="p-2 border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between">
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
            {displayedItems.length > 0 && (
                <div className="flex items-center pl-2">
                  <CustomCheckbox id="select-all-history" checked={allSelected} indeterminate={isIndeterminate} onChange={handleToggleSelectAll} label="Select All" />
                </div>
            )}
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
                      onExport={() => exportChats([session.id], [])}
                      isSelected={selectedIds.has(session.id)}
                      onToggleSelect={() => handleToggleSelection(session.id)}
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
                      onExport={() => exportChats([], [session.id])}
                      isSelected={selectedIds.has(session.id)}
                      onToggleSelect={() => handleToggleSelection(session.id)}
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
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.footer
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                className="shrink-0 bg-slate-800/95 backdrop-blur-sm border-t border-slate-700 p-3 flex items-center justify-between"
            >
                <p className="text-sm font-semibold text-slate-300">{selectedIds.size} chat(s) selected</p>
                <div className="flex items-center gap-2">
                    <button onClick={handleExportSelected} className="px-3 py-1.5 text-sm font-semibold text-sky-300 bg-sky-900/50 rounded-md hover:bg-sky-800/50 border border-sky-700/50">
                        Export Selected
                    </button>
                    <button onClick={handleDeleteSelected} className="px-3 py-1.5 text-sm font-semibold text-ember-300 bg-ember-900/50 rounded-md hover:bg-ember-800/50 border border-ember-700/50">
                        Delete Selected
                    </button>
                </div>
            </motion.footer>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default HistoryModal;
