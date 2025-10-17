import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Character, GroupChatSession, Message } from '../types';
import { Icon, IconButton } from './Icon';
import SimpleMarkdown from './SimpleMarkdown';
import { GM_CHARACTER_ID } from '../constants';
import Avatar from './Avatar';
import { useUIStore } from '../store/stores/uiStore';
import { useCharacterStore } from '../store/stores/characterStore';
import { useChatStore, GroupSession, Session } from '../store/stores/chatStore';

interface CharacterSelectionProps {
  onNewCharacter: () => void;
  onEditCharacter: (character: Character) => void;
  onNavigateToSettings: () => void;
  onNavigateToHistory: () => void;
  onNavigateToGroupSetup: () => void;
  onNavigateToWorlds: () => void;
  onNavigateToPersona: () => void;
  onNavigateToDebug: () => void;
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

type RecentSession = {
  type: 'single' | 'group';
  id: string;
  characterId?: string;
  title: string;
  avatars: (string | undefined)[];
  lastMessage: string;
  lastMessageDate: string;
  timestamp: number;
};

interface RecentChatCardProps {
  session: RecentSession;
  onSelectSingle: (characterId: string, sessionId: string) => void;
  onSelectGroup: (sessionId: string) => void;
}

const RecentChatCard: React.FC<RecentChatCardProps> = React.memo(({
  session,
  onSelectSingle,
  onSelectGroup,
}) => {
  const handleClick = useCallback(() => {
    if (session.type === 'single' && session.characterId) {
      onSelectSingle(session.characterId, session.id);
    } else if (session.type === 'group') {
      onSelectGroup(session.id);
    }
  }, [session, onSelectSingle, onSelectGroup]);

  return (
    <button
      onClick={handleClick}
      className="w-full bg-slate-900 border border-slate-800 rounded-lg hover:border-crimson-500/80 transition-all duration-300 group text-left p-3 flex items-center gap-3"
    >
      <div className="flex -space-x-3 shrink-0">
        {session.avatars.slice(0, 3).map((avatar, index) => (
          <Avatar
            key={index}
            src={avatar}
            alt=""
            shape="circle"
            className="w-10 h-10 border-2 border-slate-900"
          />
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <h3 className="font-bold text-sm text-slate-100 group-hover:text-crimson-300 transition-colors truncate">
              {session.title}
            </h3>
            {session.type === 'group' && (
              <span className="text-xs font-semibold text-ember-300 bg-ember-900/50 px-2 py-0.5 rounded-full shrink-0">
                GROUP
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium shrink-0">
            {session.lastMessageDate}
          </p>
        </div>
        <p className="text-sm text-slate-400 line-clamp-1 mt-1">
          <SimpleMarkdown text={session.lastMessage} />
        </p>
      </div>
    </button>
  );
});
RecentChatCard.displayName = 'RecentChatCard';


const ViewAllHistoryCard = React.memo(({ onClick }: { onClick: () => void }) => {
  return (
    <button
      onClick={onClick}
      className="w-full h-full bg-slate-900/50 border border-dashed border-slate-700 rounded-lg hover:border-crimson-700 hover:bg-crimson-900/20 transition-all duration-300 group flex items-center justify-center text-slate-500 hover:text-crimson-400"
    >
      <div className="flex items-center gap-3">
        <Icon
          name="history"
          className="w-6 h-6 text-slate-600 group-hover:text-crimson-400"
        />
        <span className="font-semibold text-sm group-hover:text-crimson-300">
          View All History
        </span>
      </div>
    </button>
  );
});
ViewAllHistoryCard.displayName = 'ViewAllHistoryCard';


const CharacterCard: React.FC<{
  character: Character;
  onChat: (id: string) => void;
  onEdit: (character: Character) => void;
  onDelete: (id: string) => void;
  onExport: (character: Character) => void;
  onDuplicate: (id: string) => void;
  messageCount: number;
  lastPlayedTimestamp: number;
}> = React.memo(({ character, onChat, onEdit, onDelete, onExport, onDuplicate, messageCount, lastPlayedTimestamp }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        cardRef.current.style.setProperty('--x', `${x}px`);
        cardRef.current.style.setProperty('--y', `${y}px`);
      }
    };
    cardRef.current?.addEventListener('mousemove', handleMouseMove);
    const currentCardRef = cardRef.current;
    return () =>
      currentCardRef?.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node))
        setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuAction = (action: () => void) => {
    action();
    setIsMenuOpen(false);
  };

  return (
    <div
      ref={cardRef}
      className="card-glow bg-slate-900 rounded-lg flex flex-col group relative overflow-hidden aspect-[4/5] transition-all duration-300 hover:-translate-y-1"
    >
      {character.avatar ? (
        <img
          src={character.avatar}
          alt={character.name}
          className="w-full h-full object-cover absolute inset-0 transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full absolute inset-0 bg-slate-800 flex items-center justify-center">
          <Icon name="character" className="w-1/2 h-1/2 text-slate-600" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent"></div>

      <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10 pointer-events-none">
        {messageCount > 0 && (
          <span className="text-xs font-semibold bg-crimson-600/80 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-full shadow">
            {messageCount} msgs
          </span>
        )}
        {lastPlayedTimestamp > 0 && (
          <span className="text-xs font-semibold bg-slate-700/80 backdrop-blur-sm text-slate-200 px-1.5 py-0.5 rounded-full shadow">
            {formatRelativeTime(lastPlayedTimestamp)}
          </span>
        )}
      </div>

      <div className="relative mt-auto p-4 text-white z-10 flex flex-col h-full justify-end">
         <div>
            <h3 className="font-bold text-lg">{character.name}</h3>
            <p className="text-sm text-slate-300 line-clamp-2 mt-1 h-[2.5em]">
              {character.description}
            </p>
             {character.tags && character.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                {character.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-xs font-semibold bg-ember-600/80 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-full shadow">
                    {tag}
                  </span>
                ))}
              </div>
            )}
        </div>
      </div>

      <button
        onClick={() => onChat(character.id)}
        className="absolute inset-0 z-20"
        aria-label={`Chat with ${character.name}`}
      />

      {!character.isImmutable && (
        <div
          className="absolute top-2 right-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity"
          ref={menuRef}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen((prev) => !prev);
            }}
            className="p-2 rounded-md bg-black/50 hover:bg-black/80 backdrop-blur-sm"
            aria-label="Character actions"
          >
            <Icon name="ellipsis-vertical" className="w-5 h-5 text-white" />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-md shadow-xl z-30 py-1 animate-fade-in">
              <button
                onClick={() => handleMenuAction(() => onEdit(character))}
                className="w-full flex items-center gap-3 text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700/50 transition-colors"
              >
                <Icon name="edit" className="w-4 h-4" /> Edit
              </button>
              <button
                onClick={() => handleMenuAction(() => onDuplicate(character.id))}
                className="w-full flex items-center gap-3 text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700/50 transition-colors"
              >
                <Icon name="duplicate" className="w-4 h-4" /> Duplicate
              </button>
              <button
                onClick={() => handleMenuAction(() => onExport(character))}
                className="w-full flex items-center gap-3 text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700/50 transition-colors"
              >
                <Icon name="export" className="w-4 h-4" /> Export
              </button>
              <button
                onClick={() => handleMenuAction(() => onDelete(character.id))}
                className="w-full flex items-center gap-3 text-left px-3 py-1.5 text-sm text-ember-400 hover:bg-slate-700/50 transition-colors"
              >
                <Icon name="delete" className="w-4 h-4" /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
CharacterCard.displayName = 'CharacterCard';

function NewCharacterCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-slate-900/50 rounded-lg flex flex-col items-center justify-center group relative aspect-[4/5] border border-slate-700 hover:border-crimson-500 hover:bg-slate-800/30 transition-all duration-300 hover:shadow-xl hover:shadow-crimson-600/10 animate-pulse-glow"
    >
      <Icon
        name="add"
        className="w-10 h-10 text-slate-600 group-hover:text-crimson-500 transition-colors"
      />
      <p className="mt-2 font-semibold text-slate-500 group-hover:text-crimson-400">
        Create Character
      </p>
    </button>
  );
}

type SortOrder = 'last-played' | 'name-asc' | 'name-desc';

const RECENT_CHAT_LIMIT = 5;

function CharacterSelection({
  onNewCharacter,
  onEditCharacter,
  onNavigateToSettings,
  onNavigateToHistory,
  onNavigateToGroupSetup,
  onNavigateToWorlds,
  onNavigateToPersona,
  onNavigateToDebug,
}: CharacterSelectionProps) {
  const { characters, deleteCharacter, importCharacters, duplicateCharacter } = useCharacterStore();
  const { sessions, groupSessions, characterSessions, messages: allMessages, newSession } = useChatStore();
  const { setCurrentView, setActiveCharacterId, setActiveSessionId, setActiveGroupSessionId } = useUIStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('last-played');

  const handleSelectSession = useCallback((characterId: string, sessionId: string) => {
    setActiveCharacterId(characterId);
    setActiveSessionId(sessionId);
    setCurrentView('CHAT');
  }, [setActiveCharacterId, setActiveSessionId, setCurrentView]);

  const handleSelectGroupSession = useCallback((sessionId: string) => {
    setActiveGroupSessionId(sessionId);
    setCurrentView('GROUP_CHAT');
  }, [setActiveGroupSessionId, setCurrentView]);

  const handleStartChat = useCallback((characterId: string) => {
    const sessionId = newSession(characterId);
    if (sessionId) {
      handleSelectSession(characterId, sessionId);
    }
  }, [newSession, handleSelectSession]);

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          if (
            Array.isArray(imported) &&
            imported.every((item) => 'id' in item && 'name' in item)
          ) {
            importCharacters(imported);
          } else {
            alert('Invalid character file format.');
          }
        } catch (error) {
          alert('Failed to parse character file.');
        }
      };
      reader.readAsText(file);
      if (event.target) event.target.value = '';
    }
  };

  const handleExportCharacter = useCallback((character: Character) => {
    try {
      const filename = `${character.name
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase()}_character.json`;
      const blob = new Blob([JSON.stringify([character], null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(
        `Error exporting character: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      );
    }
  }, []);

  const { recentSessions, totalRecentCount } = useMemo(() => {
    // FIX: Add explicit type assertion for `characterSessions` to resolve 'unknown' type error from persisted state.
    const singleSessions = Object.entries(characterSessions as Record<string, string[]>).flatMap(
      ([charId, sessionIds]: [string, string[]]) => {
        const char = characters.find((c) => c.id === charId);
        return char
          ? sessionIds.map((sessionId) => {
                const s: Session | undefined = sessions[sessionId];
                if (!s || (s.messageIds || []).length === 0) return null;
                const lastMessage = s.messageIds.length > 0 ? allMessages[s.messageIds[s.messageIds.length-1]] : null;
                return {
                    type: 'single' as const,
                    id: s.id,
                    characterId: charId,
                    title: char.name,
                    avatars: [char.avatar],
                    lastMessage: lastMessage?.content || 'Chat started.',
                    timestamp: lastMessage?.timestamp || 0,
                };
            }).filter((s): s is NonNullable<typeof s> => s !== null)
          : [];
      },
    );

    const groupSessionsMapped = Object.values(groupSessions).map(
      (s: GroupSession) => {
        const sessionChars = s.characterIds
          .map((id) => characters.find((c) => c.id === id))
          .filter(Boolean) as Character[];
        if ((s.messageIds || []).length === 0) return null;
        const lastMessage = s.messageIds.length > 0 ? allMessages[s.messageIds[s.messageIds.length-1]] : null;
        return {
          type: 'group' as const,
          id: s.id,
          title: s.title,
          avatars: sessionChars.map((c) => c.avatar),
          lastMessage:
            lastMessage?.content ||
            'Group chat started.',
          timestamp: lastMessage?.timestamp || 0,
        };
      },
    ).filter((s): s is NonNullable<typeof s> => s !== null);

    const allSessions = [...singleSessions, ...groupSessionsMapped]
      .filter((s) => s.timestamp > 0)
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((s) => ({ ...s, lastMessageDate: formatRelativeTime(s.timestamp) }));

    return {
      recentSessions: allSessions.slice(0, RECENT_CHAT_LIMIT),
      totalRecentCount: allSessions.length,
    };
  }, [characters, sessions, groupSessions, characterSessions, allMessages]);

  const userCharacters = useMemo(
    () => characters.filter((c) => !c.isImmutable),
    [characters],
  );

  const lastPlayedTimestamps = useMemo(() => {
    const timestamps = new Map<string, number>();
    // FIX: Add explicit type assertion for `characterSessions` to resolve 'unknown' type error from persisted state.
    Object.entries(characterSessions as Record<string, string[]>).forEach(
      ([charId, sessionIds]: [string, string[]]) => {
        let maxTimestamp = 0;
        sessionIds.forEach((sessionId) => {
            const session = sessions[sessionId];
            if (session && session.messageIds && session.messageIds.length > 0) {
              const lastMessage = allMessages[session.messageIds[session.messageIds.length - 1]];
              if (lastMessage?.timestamp && lastMessage.timestamp > maxTimestamp) {
                maxTimestamp = lastMessage.timestamp;
              }
            }
        });
        if (maxTimestamp > 0) {
          timestamps.set(charId, maxTimestamp);
        }
      },
    );
    return timestamps;
  }, [characterSessions, sessions, allMessages]);
  
  const messageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    // FIX: Add explicit type assertion for `characterSessions` to resolve 'unknown' type error from persisted state.
    Object.entries(characterSessions as Record<string, string[]>).forEach(([charId, sessionIds]) => {
        let total = 0;
        sessionIds.forEach(sessionId => {
            const session = sessions[sessionId];
            if (session) {
                total += (session.messageIds || [])
                    .map(id => allMessages[id])
                    .filter(msg => msg && msg.role !== 'system')
                    .length;
            }
        });
        counts.set(charId, total);
    });
    return counts;
  }, [characterSessions, sessions, allMessages]);

  const sortedAndFilteredCharacters = useMemo(() => {
    return userCharacters
      .filter((char) =>
        char.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .sort((a, b) => {
        switch (sortOrder) {
          case 'name-asc':
            return a.name.localeCompare(b.name);
          case 'name-desc':
            return b.name.localeCompare(a.name);
          case 'last-played':
          default:
            const tsA = lastPlayedTimestamps.get(a.id) || 0;
            const tsB = lastPlayedTimestamps.get(b.id) || 0;
            return tsB - tsA;
        }
      });
  }, [userCharacters, searchQuery, sortOrder, lastPlayedTimestamps]);

  const handleEdit = useCallback(
    (character: Character) => {
      onEditCharacter(character);
    },
    [onEditCharacter],
  );

  return (
    <div className="w-full h-screen bg-transparent flex flex-col">
      <header className="p-4 flex justify-between items-center border-b border-slate-800 shrink-0 bg-slate-950/70 backdrop-blur-sm sticky top-0 z-20">
        <h1 className="text-2xl font-bold font-display tracking-widest uppercase">
          Roleplay <span className="text-crimson-400">Nexus</span>
        </h1>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImport}
            className="hidden"
            accept=".json"
          />
          <IconButton
            onClick={() => fileInputRef.current?.click()}
            icon="import"
            label="Import Characters"
          />
          <IconButton
            onClick={onNavigateToWorlds}
            icon="book-open"
            label="Worlds"
          />
          <IconButton
            onClick={onNavigateToHistory}
            icon="history"
            label="History"
          />
          <IconButton
            onClick={onNavigateToPersona}
            icon="character"
            label="My Persona"
          />
          <IconButton
            onClick={onNavigateToSettings}
            icon="sliders"
            label="Settings"
          />
          <IconButton
            onClick={onNavigateToDebug}
            icon="terminal"
            label="Debug Console"
          />
          <div className="h-6 w-px bg-slate-700 mx-1"></div>
          <button
            onClick={() => handleStartChat(GM_CHARACTER_ID)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-slate-700/50 hover:bg-slate-700 rounded-md transition-colors border border-slate-600"
          >
            <Icon name="play" className="w-4 h-4" /> Start GM Session
          </button>
          <IconButton
            onClick={onNavigateToGroupSetup}
            icon="add"
            label="Start Group Chat"
            primary
          />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
        {recentSessions.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-bold text-slate-200 mb-8 font-display tracking-wider uppercase">
              Recent Chats
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-x-6 gap-y-4">
              {recentSessions.map((session) => (
                <RecentChatCard
                  key={`${session.type}-${session.id}`}
                  session={session}
                  onSelectSingle={handleSelectSession}
                  onSelectGroup={handleSelectGroupSession}
                />
              ))}
              {totalRecentCount > RECENT_CHAT_LIMIT && (
                <ViewAllHistoryCard onClick={onNavigateToHistory} />
              )}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-200 font-display tracking-wider uppercase">
            Characters
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search characters..."
                className="w-full bg-slate-900 border-2 border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-crimson-500 focus:border-crimson-500 transition"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="bg-slate-900 border-2 border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-crimson-500 focus:border-crimson-500 transition appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em',
                paddingRight: '2.5rem',
              }}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              aria-label="Sort characters"
            >
              <option value="last-played">Sort: Last Played</option>
              <option value="name-asc">Sort: Name (A-Z)</option>
              <option value="name-desc">Sort: Name (Z-A)</option>
            </select>
          </div>
        </div>

        {characters.length > 1 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
            <NewCharacterCard onClick={onNewCharacter} />
            {sortedAndFilteredCharacters.map((char) => (
              <CharacterCard
                key={char.id}
                character={char}
                onChat={handleStartChat}
                onEdit={handleEdit}
                onDelete={deleteCharacter}
                onExport={handleExportCharacter}
                onDuplicate={duplicateCharacter}
                messageCount={messageCounts.get(char.id) || 0}
                lastPlayedTimestamp={lastPlayedTimestamps.get(char.id) || 0}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 py-16">
            <Icon name="character" className="w-20 h-20 mb-4 text-slate-700" />
            <h2 className="text-3xl font-bold text-slate-300 font-display">
              WELCOME TO ROLEPLAY NEXUS
            </h2>
            <p className="max-w-sm mt-2">
              No characters found. Forge your first ally to begin the adventure.
            </p>
            <button
              onClick={onNewCharacter}
              className="flex items-center gap-2 px-5 py-3 mt-8 text-base font-semibold text-white bg-crimson-600 hover:bg-crimson-500 rounded-lg shadow-lg hover:shadow-crimson-500/50 transition-all border border-crimson-400/50"
            >
              <Icon name="add" className="w-5 h-5" /> Create Your First Character
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default CharacterSelection;