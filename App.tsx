import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useUIStore } from './store/stores/uiStore';
import { useSettingsStore } from './store/stores/settingsStore';
import { useCharacterStore } from './store/stores/characterStore';
import { useWorldStore } from './store/stores/worldStore';
import { useChatStore, Session, GroupSession } from './store/stores/chatStore';
import { useAppStateForDebug } from './store/selectors';
import { Character } from './types';
import { logger } from './services/logger';
import { AnimatePresence } from 'framer-motion';
import BackgroundAnimation from './components/BackgroundAnimation';
import ComponentErrorBoundary from './components/ComponentErrorBoundary';
import ThemeApplicator from './components/ThemeApplicator';
import LoadingIndicator from './components/LoadingIndicator';
import { GM_CHARACTER, DEFAULT_CHARACTER } from './constants';
import { warmWorldCache } from './services/llmService';

// --- Lazy Loaded Components ---
const ChatWindow = lazy(() => import('./components/ChatWindow'));
const CharacterEditor = lazy(() => import('./components/CharacterEditor'));
const CharacterSelection = lazy(() => import('./components/CharacterSelection'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const HistoryModal = lazy(() => import('./components/HistoryModal'));
const GroupChatSetup = lazy(() => import('./components/GroupChatSetup'));
const GroupChatWindow = lazy(() => import('./components/GroupChatWindow'));
const WorldsPage = lazy(() => import('./components/WorldsPage'));
const ConfirmationModal = lazy(() => import('./components/ConfirmationModal'));
const PersonaEditor = lazy(() => import('./components/PersonaEditor'));
const DebugWindow = lazy(() => import('./components/DebugWindow'));

function App() {
  const {
    currentView,
    isConfirmationModalOpen,
    handleCloseConfirmation,
    handleConfirm,
    confirmationAction,
    isInitialized,
    setInitialized,
    activeCharacterId,
    activeSessionId,
    activeGroupSessionId,
    setCurrentView,
    resetChatView
  } = useUIStore();
  
  const userPersona = useSettingsStore(state => state.userPersona);
  const worlds = useWorldStore(state => state.worlds);
  const characters = useCharacterStore(state => state.characters);
  const getAppState = useAppStateForDebug;
  const { sessions, groupSessions, messages } = useChatStore();

  useEffect(() => {
    if (!isInitialized) {
      logger.log('Store initializing...');
      // This logic was previously in initStore
      const { _setCharacters, characters } = useCharacterStore.getState();
      let currentChars = characters;
      if (!currentChars.some(c => c.id === GM_CHARACTER.id)) {
        currentChars = [GM_CHARACTER, ...currentChars];
      }
      if (currentChars.filter(c => !c.isImmutable).length === 0) {
        if (!currentChars.some(c => c.id === DEFAULT_CHARACTER.id)) {
            currentChars.push(DEFAULT_CHARACTER);
        }
      }
      _setCharacters(currentChars);
      setInitialized(true);
      logger.log('Store initialized');
    }
  }, [isInitialized, setInitialized]);

  // Effect for smart cache warming on startup
  useEffect(() => {
    if (isInitialized && worlds.length > 0) {
      const RECENT_SESSION_LIMIT = 5;

      const allSessionsWithTimestamps = [
        // FIX: Add explicit types for session objects to resolve 'unknown' type errors.
        ...Object.values(sessions).map((s: Session) => ({
          worldId: s.worldId,
          timestamp: s.messageIds.length > 0 ? messages[s.messageIds[s.messageIds.length - 1]]?.timestamp || 0 : 0,
        })),
        // FIX: Add explicit types for session objects to resolve 'unknown' type errors.
        ...Object.values(groupSessions).map((s: GroupSession) => ({
          worldId: s.worldId,
          timestamp: s.messageIds.length > 0 ? messages[s.messageIds[s.messageIds.length - 1]]?.timestamp || 0 : 0,
        }))
      ];
      
      const recentWorldIds = allSessionsWithTimestamps
        .filter(s => s.worldId && s.timestamp > 0)
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(s => s.worldId!)
        .filter((id, index, self) => self.indexOf(id) === index)
        .slice(0, RECENT_SESSION_LIMIT);

      if (recentWorldIds.length > 0) {
        const worldsToWarm = worlds.filter(w => recentWorldIds.includes(w.id));
        // Use queueMicrotask to defer this work slightly and not block the main thread.
        queueMicrotask(() => warmWorldCache(worldsToWarm));
      }
    }
  }, [isInitialized, worlds, sessions, groupSessions, messages]);

  useEffect(() => {
    const activeCharacter = characters.find((c) => c.id === activeCharacterId);
    if (
      (currentView === 'CHAT' && (!activeCharacter || !activeSessionId)) ||
      (currentView === 'GROUP_CHAT' && !activeGroupSessionId)
    ) {
      logger.log('Invalid state for view, redirecting to CHARACTER_SELECTION', {
        currentView,
        activeCharacterId,
        activeSessionId,
        activeGroupSessionId,
      });
      resetChatView();
    }
  }, [
    currentView,
    characters,
    activeCharacterId,
    activeSessionId,
    activeGroupSessionId,
    resetChatView
  ]);

  // --- Modal State Management ---
  const [modals, setModals] = useState({
    characterEditor: false,
    personaEditor: false,
    settings: false,
    history: false,
    worlds: false,
    debug: false,
  });

  const openModal = (modal: keyof typeof modals) => setModals((prev) => ({ ...prev, [modal]: true }));
  const closeModal = (modal: keyof typeof modals) => setModals((prev) => ({ ...prev, [modal]: false }));
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const handleNewCharacter = () => {
    setEditingCharacter(null);
    openModal('characterEditor');
  };
  const handleEditCharacter = (character: Character) => {
    setEditingCharacter(character);
    openModal('characterEditor');
  };

  const renderView = () => {
    switch (currentView) {
      case 'CHAT':
        if (!activeCharacterId || !activeSessionId) return null;
        return <ChatWindow onNavigateToHistory={() => openModal('history')} />;
      case 'GROUP_CHAT_SETUP':
        return <GroupChatSetup onBack={() => setCurrentView('CHARACTER_SELECTION')} />;
      case 'GROUP_CHAT':
        if (!activeGroupSessionId) return null;
        return <GroupChatWindow onNavigateToHistory={() => openModal('history')} />;
      case 'CHARACTER_SELECTION':
      default:
        return (
          <CharacterSelection
            onNewCharacter={handleNewCharacter}
            onEditCharacter={handleEditCharacter}
            onNavigateToSettings={() => openModal('settings')}
            onNavigateToHistory={() => openModal('history')}
            onNavigateToGroupSetup={() => setCurrentView('GROUP_CHAT_SETUP')}
            onNavigateToWorlds={() => openModal('worlds')}
            onNavigateToPersona={() => openModal('personaEditor')}
            onNavigateToDebug={() => openModal('debug')}
          />
        );
    }
  };

  return (
    <div className="h-screen w-full text-slate-100 font-sans overflow-hidden relative">
      <ThemeApplicator />
      <BackgroundAnimation />
      <ComponentErrorBoundary componentName="Main View">
        <Suspense fallback={<LoadingIndicator fullscreen message="Loading View..." />}>
          {renderView()}
        </Suspense>
      </ComponentErrorBoundary>

      {/* --- Modals --- */}
      <AnimatePresence>
        {modals.characterEditor && (
          <Suspense fallback={null}>
            <ComponentErrorBoundary componentName="Character Editor Modal">
              <CharacterEditor
                character={editingCharacter}
                onClose={() => closeModal('characterEditor')}
              />
            </ComponentErrorBoundary>
          </Suspense>
        )}
        {modals.personaEditor && (
          <Suspense fallback={null}>
            <ComponentErrorBoundary componentName="Persona Editor Modal">
              <PersonaEditor
                persona={userPersona}
                onClose={() => closeModal('personaEditor')}
              />
            </ComponentErrorBoundary>
          </Suspense>
        )}
        {modals.settings && (
          <Suspense fallback={null}>
            <ComponentErrorBoundary componentName="Settings Modal">
              <SettingsModal onClose={() => closeModal('settings')} />
            </ComponentErrorBoundary>
          </Suspense>
        )}
        {modals.history && (
          <Suspense fallback={null}>
            <ComponentErrorBoundary componentName="History Modal">
              <HistoryModal onClose={() => closeModal('history')} />
            </ComponentErrorBoundary>
          </Suspense>
        )}
        {modals.worlds && (
          <Suspense fallback={null}>
            <ComponentErrorBoundary componentName="Worlds Modal">
              <WorldsPage worlds={worlds} onClose={() => closeModal('worlds')} />
            </ComponentErrorBoundary>
          </Suspense>
        )}
        {isConfirmationModalOpen && (
          <Suspense fallback={null}>
            <ComponentErrorBoundary componentName="Confirmation Modal">
              <ConfirmationModal
                onClose={handleCloseConfirmation}
                onConfirm={handleConfirm}
                title={confirmationAction?.title || ''}
                message={confirmationAction?.message || ''}
                confirmButtonText={confirmationAction?.confirmText}
                confirmButtonVariant={confirmationAction?.confirmVariant}
              />
            </ComponentErrorBoundary>
          </Suspense>
        )}
        {modals.debug && (
          <Suspense fallback={null}>
            <ComponentErrorBoundary componentName="Debug Window Modal">
              <DebugWindow
                onClose={() => closeModal('debug')}
                appState={getAppState()}
              />
            </ComponentErrorBoundary>
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;