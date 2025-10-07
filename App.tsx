import React, { useState } from 'react';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { Character, Persona, World } from './types';
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

function AppContent() {
  const {
    currentView,
    activeCharacter,
    activeSession,
    activeGroupSession,
    characters,
    userPersona,
    worlds,
    isConfirmationModalOpen,
    handleCloseConfirmation,
    handleConfirm,
    confirmationAction,
    getAppState,
  } = useAppContext();

  // --- Modal State Management ---
  const [isCharacterEditorOpen, setIsCharacterEditorOpen] = useState(false);
  const [isPersonaEditorOpen, setIsPersonaEditorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isWorldsModalOpen, setIsWorldsModalOpen] = useState(false);
  const [isDebugWindowOpen, setIsDebugWindowOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  
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
        if (!activeCharacter || !activeSession) return null;
        return <ChatWindow />;
      case 'GROUP_CHAT_SETUP':
        return <GroupChatSetup onBack={() => useAppContext().setCurrentView('CHARACTER_SELECTION')} />;
      case 'GROUP_CHAT':
        if (!activeGroupSession) return null;
        return <GroupChatWindow />;
      case 'CHARACTER_SELECTION':
      default:
        return (
          <CharacterSelection
            onNewCharacter={handleNewCharacter}
            onEditCharacter={handleEditCharacter}
            onNavigateToSettings={() => setIsSettingsOpen(true)}
            onNavigateToHistory={() => setIsHistoryOpen(true)}
            onNavigateToGroupSetup={() => useAppContext().setCurrentView('GROUP_CHAT_SETUP')}
            onNavigateToWorlds={() => setIsWorldsModalOpen(true)}
            onNavigateToPersona={() => setIsPersonaEditorOpen(true)}
            onNavigateToDebug={() => setIsDebugWindowOpen(true)}
          />
        );
    }
  };

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-100 font-sans bg-gaming-pattern overflow-hidden">
      {renderView()}

      {/* --- Modals --- */}
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
        <SettingsModal 
            onClose={() => setIsSettingsOpen(false)}
        />
      )}
      {isHistoryOpen && (
        <HistoryModal
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
       {isWorldsModalOpen && (
        <WorldsPage
            worlds={worlds}
            onClose={() => setIsWorldsModalOpen(false)}
        />
       )}
       <ConfirmationModal 
        isOpen={isConfirmationModalOpen}
        onClose={handleCloseConfirmation}
        onConfirm={handleConfirm}
        title={confirmationAction?.title || ''}
        message={confirmationAction?.message || ''}
        confirmButtonText={confirmationAction?.confirmText}
        confirmButtonVariant={confirmationAction?.confirmVariant}
      />
      <DebugWindow 
        isOpen={isDebugWindowOpen}
        onClose={() => setIsDebugWindowOpen(false)}
        appState={getAppState()}
      />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
