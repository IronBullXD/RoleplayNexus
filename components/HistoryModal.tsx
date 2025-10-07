import React, { useState, useMemo, useEffect } from 'react';
import { Character, ChatSession, GroupChatSession } from '../types';
import { Icon } from './Icon';
import Avatar from './Avatar';
import { useAppContext } from '../contexts/AppContext';

interface HistoryModalProps {
  onClose: () => void;
}

const HistoryItem: React.FC<{ avatars: (string | undefined)[]; title: string; subtitle: string; lastMessage: string; lastMessageTimestamp?: number; onSelect: () => void; onDelete: () => void; }> = ({ avatars, title, subtitle, lastMessage, lastMessageTimestamp, onSelect, onDelete }) => (
    <div className="w-full flex items-center gap-2 p-2 pr-4 bg-slate-900/50 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-800/50 rounded-lg transition-all group">
        <button onClick={onSelect} className="flex-1 flex items-start gap-4 overflow-hidden text-left p-2">
            <div className="flex -space-x-5 shrink-0">
                {avatars.slice(0, 3).map((avatar, i) => <Avatar key={i} src={avatar} alt="" shape="circle" className="w-12 h-12 border-2 border-slate-900" />)}
            </div>
            <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-baseline">
                    <h2 className="font-bold text-slate-100 truncate">{title}</h2>
                    {lastMessageTimestamp && <p className="text-xs text-slate-500 shrink-0 ml-4 font-mono">{new Date(lastMessageTimestamp).toLocaleDateString()}</p>}
                </div>
                <p className="text-sm text-slate-400 truncate mt-1"><span className="font-medium">{subtitle}</span> - {lastMessage || 'No messages yet.'}</p>
            </div>
        </button>
        <button onClick={onDelete} className="p-2 text-slate-500 hover:text-fuchsia-500 hover:bg-slate-700/50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-label={`Delete chat: ${title}`}><Icon name="delete" className="w-5 h-5" /></button>
    </div>
);

const HistoryModal: React.FC<HistoryModalProps> = ({ onClose }) => {
    const { characters, conversations, groupConversations, selectSession, selectGroupSession, deleteSession, deleteGroupSession } = useAppContext();
    const [activeTab, setActiveTab] = useState<'single' | 'group'>('single');

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const charactersById = useMemo(() => new Map(characters.map(c => [c.id, c])), [characters]);

    const singleChatSessions = useMemo(() => (
        (Object.entries(conversations) as [string, ChatSession[]][])
            .flatMap(([charId, sessions]) => sessions.map(s => ({ charId, session: s, lastMessageTimestamp: s.messages[s.messages.length - 1]?.timestamp || 0 })))
            .sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp)
    ), [conversations]);

    const groupChatSessions = useMemo(() => (
        (Object.values(groupConversations) as GroupChatSession[])
            .map(s => ({ session: s, lastMessageTimestamp: s.messages[s.messages.length - 1]?.timestamp || 0 }))
            .sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp)
    ), [groupConversations]);
    
    return (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl flex flex-col border border-slate-700 h-[80vh] animate-slide-up" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold font-display tracking-widest uppercase">Chat History</h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md"><Icon name="close" /></button>
                </header>

                <div className="p-2 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setActiveTab('single')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'single' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>Single Chats</button>
                        <button onClick={() => setActiveTab('group')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'group' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>Group Chats</button>
                    </div>
                </div>

                <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                    {activeTab === 'single' ? (
                        <div className="space-y-3">
                            {singleChatSessions.length > 0 ? singleChatSessions.map(({ session, charId }) => {
                                const character = charactersById.get(charId);
                                if (!character) return null;
                                const lastMessage = session.messages[session.messages.length - 1];
                                return ( <HistoryItem key={session.id} avatars={[character.avatar]} title={character.name} subtitle={session.title} lastMessage={lastMessage?.content} lastMessageTimestamp={lastMessage?.timestamp} onSelect={() => { selectSession(charId, session.id); onClose(); }} onDelete={() => deleteSession(charId, session.id)} /> );
                            }) : <p className="text-center text-slate-500 pt-8">No single chat history found.</p>}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {groupChatSessions.length > 0 ? groupChatSessions.map(({ session }) => {
                                const sessionCharacters = session.characterIds.map(id => charactersById.get(id)).filter((c): c is Character => !!c);
                                const lastMessage = session.messages[session.messages.length - 1];
                                return ( <HistoryItem key={session.id} avatars={sessionCharacters.map(c => c.avatar)} title={session.title} subtitle="Group Chat" lastMessage={lastMessage?.content} lastMessageTimestamp={lastMessage?.timestamp} onSelect={() => { selectGroupSession(session.id); onClose(); }} onDelete={() => deleteGroupSession(session.id)} /> );
                            }) : <p className="text-center text-slate-500 pt-8">No group chat history found.</p>}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default HistoryModal;
