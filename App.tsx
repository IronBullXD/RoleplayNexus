import React, { useState, useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { Character } from './types';
import ChatWindow from './components/ChatWindow';
import CharacterEditor from './components/CharacterEditor';
import CharacterSelection from './components/CharacterSelection';
import SettingsModal from './components/SettingsModal';
import HistoryModal from './components/HistoryModal';
import GroupChatSetup from './components/GroupChatSetup';
import GroupChatWindow from './components/GroupChatWindow';
import WorldsPage from './components/WorldsPage';
import ConfirmationModal from './components/ConfirmationModal';
import PersonaEditor from './components/PersonaEditor';
import DebugWindow from './components/DebugWindow';
import { logger } from './services/logger';
import { AnimatePresence } from 'framer-motion';
import BackgroundAnimation from './components/BackgroundAnimation';

function App() {
  const {
    currentView,
    isConfirmationModalOpen,
    handleCloseConfirmation,
    handleConfirm,
    confirmationAction,
    getAppState,
    userPersona,
    worlds,
    setCurrentView,
    initStore,
  } = useAppStore();

  const activeCharacterId = useAppStore((state) => state.activeCharacterId);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const activeGroupSessionId = useAppStore(
    (state) => state.activeGroupSessionId,
  );
  const characters = useAppStore((state) => state.characters);

  useEffect(() => {
    initStore(); // Ensures GM character is present on startup
  }, [initStore]);

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
      useAppStore.getState().resetChatView();
    }
  }, [
    currentView,
    characters,
    activeCharacterId,
    activeSessionId,
    activeGroupSessionId,
  ]);

  // --- Modal State Management ---
  const [isCharacterEditorOpen, setIsCharacterEditorOpen] = useState(false);
  const [isPersonaEditorOpen, setIsPersonaEditorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isWorldsModalOpen, setIsWorldsModalOpen] = useState(false);
  const [isDebugWindowOpen, setIsDebugWindowOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(
    null,
  );

  const handleNewCharacter = () => {
    setEditingCharacter(null);
    setIsCharacterEditorOpen(true);
  };

  const handleEditCharacter = (character: Character) => {
    setEditingCharacter(character);
    setIsCharacterEditorOpen(true);
  };

  const renderView = () => {
    switch (currentView) {
      case 'CHAT':
        if (!activeCharacterId || !activeSessionId) return null;
        return <ChatWindow onNavigateToHistory={() => setIsHistoryOpen(true)} />;
      case 'GROUP_CHAT_SETUP':
        return (
          <GroupChatSetup onBack={() => setCurrentView('CHARACTER_SELECTION')} />
        );
      case 'GROUP_CHAT':
        if (!activeGroupSessionId) return null;
        return (
          <GroupChatWindow onNavigateToHistory={() => setIsHistoryOpen(true)} />
        );
      case 'CHARACTER_SELECTION':
      default:
        return (
          <CharacterSelection
            onNewCharacter={handleNewCharacter}
            onEditCharacter={handleEditCharacter}
            onNavigateToSettings={() => setIsSettingsOpen(true)}
            onNavigateToHistory={() => setIsHistoryOpen(true)}
            onNavigateToGroupSetup={() => setCurrentView('GROUP_CHAT_SETUP')}
            onNavigateToWorlds={() => setIsWorldsModalOpen(true)}
            onNavigateToPersona={() => setIsPersonaEditorOpen(true)}
            onNavigateToDebug={() => setIsDebugWindowOpen(true)}
          />
        );
    }
  };

  return (
    <div className="h-screen w-full text-slate-100 font-sans overflow-hidden relative">
      <BackgroundAnimation />
      {renderView()}

      {/* --- Modals --- */}
      <AnimatePresence>
        {isCharacterEditorOpen && (
          <CharacterEditor
            character={editingCharacter}
            onClose={() => setIsCharacterEditorOpen(false)}
          />
        )}
        {isPersonaEditorOpen && (
          <PersonaEditor
            persona={userPersona}
            onClose={() => setIsPersonaEditorOpen(false)}
          />
        )}
        {isSettingsOpen && (
          <SettingsModal onClose={() => setIsSettingsOpen(false)} />
        )}
        {isHistoryOpen && (
          <HistoryModal onClose={() => setIsHistoryOpen(false)} />
        )}
        {isWorldsModalOpen && (
          <WorldsPage
            worlds={worlds}
            onClose={() => setIsWorldsModalOpen(false)}
          />
        )}
        {isConfirmationModalOpen && (
          <ConfirmationModal
            onClose={handleCloseConfirmation}
            onConfirm={handleConfirm}
            title={confirmationAction?.title || ''}
            message={confirmationAction?.message || ''}
            confirmButtonText={confirmationAction?.confirmText}
            confirmButtonVariant={confirmationAction?.confirmVariant}
          />
        )}
        {isDebugWindowOpen && (
          <DebugWindow
            onClose={() => setIsDebugWindowOpen(false)}
            appState={getAppState()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;