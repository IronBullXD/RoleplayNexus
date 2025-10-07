import React from 'react';
import { Character, GroupChatSession, ChatSession } from '../../types';
import { logger } from '../../services/logger';

type LastActiveSessionInfo = { type: 'single' | 'group', sessionId: string, characterId?: string };

interface UseCharacterLogicProps {
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  requestConfirmation: (action: () => void, title: string, message: React.ReactNode, confirmText?: string, confirmVariant?: 'danger' | 'primary') => void;
  setConversations: React.Dispatch<React.SetStateAction<Record<string, ChatSession[]>>>;
  setGroupConversations: React.Dispatch<React.SetStateAction<Record<string, GroupChatSession>>>;
  activeCharacterId: string | null;
  setActiveCharacterId: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentView: (view: 'CHARACTER_SELECTION' | 'CHAT' | 'GROUP_CHAT_SETUP' | 'GROUP_CHAT') => void;
  lastActiveSessionInfo: LastActiveSessionInfo | null;
  setLastActiveSessionInfo: React.Dispatch<React.SetStateAction<LastActiveSessionInfo | null>>;
}

export const useCharacterLogic = ({
  characters, setCharacters, requestConfirmation, setConversations, setGroupConversations,
  activeCharacterId, setActiveCharacterId, setActiveSessionId, setCurrentView,
  lastActiveSessionInfo, setLastActiveSessionInfo
}: UseCharacterLogicProps) => {

  const saveCharacter = (character: Character) => {
    setCharacters(prev => prev.find(c => c.id === character.id) ? prev.map(c => c.id === character.id ? character : c) : [...prev, character]);
  };

  const deleteCharacter = (id: string) => {
    const charToDelete = characters.find(c => c.id === id);
    if (!charToDelete || charToDelete.isImmutable) return;
    // FIX: Replaced JSX with a template string to prevent syntax errors in a .ts file.
    requestConfirmation(() => {
        const isDeletingActive = activeCharacterId === id;
        setCharacters(prev => prev.filter(c => c.id !== id));
        setConversations(prev => { const newState = {...prev}; delete newState[id]; return newState; });
        setGroupConversations(prev => {
            const newState = {...prev};
            Object.keys(newState).forEach(sid => { 
                const session = newState[sid];
                if (session.characterIds.includes(id)) {
                    // If removing the character makes the group chat invalid ( < 2 members), delete it.
                    if (session.characterIds.length <= 2) {
                        delete newState[sid];
                    } else {
                        newState[sid] = { ...session, characterIds: session.characterIds.filter(cid => cid !== id) };
                    }
                }
            });
            return newState;
        });
        if (isDeletingActive) {
            setActiveCharacterId(null); setActiveSessionId(null); setCurrentView('CHARACTER_SELECTION');
        }
        if (lastActiveSessionInfo?.characterId === id) {
            setLastActiveSessionInfo(null);
        }
    }, 'Delete Character', `Are you sure you want to delete "${charToDelete.name}"? All associated single and group chat histories will also be permanently deleted.`, 'Delete Character', 'danger');
  };

  const duplicateCharacter = (id: string) => {
    const characterToCopy = characters.find(c => c.id === id);
    if (!characterToCopy) return;
    
    const newCharacter = JSON.parse(JSON.stringify(characterToCopy));
    
    newCharacter.id = crypto.randomUUID();
    newCharacter.name = `${newCharacter.name} (Copy)`;
    delete newCharacter.isImmutable;

    logger.uiEvent('Duplicating character', { originalId: id, newId: newCharacter.id });
    setCharacters(prev => [...prev, newCharacter]);
  };

  const importCharacters = (importedCharacters: Character[]) => {
    const existingIds = new Set(characters.map(c => c.id));
    const newCharacters = importedCharacters.filter(ic => !existingIds.has(ic.id));
    setCharacters(prev => [...prev, ...newCharacters]);
    alert(`${newCharacters.length} new character(s) imported successfully!`);
  };

  return {
    saveCharacter,
    deleteCharacter,
    duplicateCharacter,
    importCharacters
  };
};