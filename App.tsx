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
import ComponentErrorBoundary from './components/ComponentErrorBoundary';

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
  const [modals, setModals] = useState({
    characterEditor: false,
    personaEditor: false,
    settings: false,
    history: false,
    worlds: false,
    debug: false,
  });

  const openModal = (modal: keyof typeof modals) =>
    setModals((prev) => ({ ...prev, [modal]: true }));
  const closeModal = (modal: keyof typeof modals) =>
    setModals((prev) => ({ ...prev, [modal]: false }));

  const [editingCharacter, setEditingCharacter] = useState<Character | null>(
    null,
  );

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
        return (
          <GroupChatSetup onBack={() => setCurrentView('CHARACTER_SELECTION')} />
        );
      case 'GROUP_CHAT':
        if (!activeGroupSessionId) return null;
        return (
          <GroupChatWindow onNavigateToHistory={() => openModal('history')} />
        );
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
      <BackgroundAnimation />
      <ComponentErrorBoundary componentName="Main View">
        {renderView()}
      </ComponentErrorBoundary>

      {/* --- Modals --- */}
      <AnimatePresence>
        {modals.characterEditor && (
          <ComponentErrorBoundary componentName="Character Editor Modal">
            <CharacterEditor
              character={editingCharacter}
              onClose={() => closeModal('characterEditor')}
            />
          </ComponentErrorBoundary>
        )}
        {modals.personaEditor && (
          <ComponentErrorBoundary componentName="Persona Editor Modal">
            <PersonaEditor
              persona={userPersona}
              onClose={() => closeModal('personaEditor')}
            />
          </ComponentErrorBoundary>
        )}
        {modals.settings && (
          <ComponentErrorBoundary componentName="Settings Modal">
            <SettingsModal onClose={() => closeModal('settings')} />
          </ComponentErrorBoundary>
        )}
        {modals.history && (
          <ComponentErrorBoundary componentName="History Modal">
            <HistoryModal onClose={() => closeModal('history')} />
          </ComponentErrorBoundary>
        )}
        {modals.worlds && (
          <ComponentErrorBoundary componentName="Worlds Modal">
            <WorldsPage worlds={worlds} onClose={() => closeModal('worlds')} />
          </ComponentErrorBoundary>
        )}
        {isConfirmationModalOpen && (
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
        )}
        {modals.debug && (
          <ComponentErrorBoundary componentName="Debug Window Modal">
            <DebugWindow
              onClose={() => closeModal('debug')}
              appState={getAppState()}
            />
          </ComponentErrorBoundary>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
