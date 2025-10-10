import React, { createContext, useContext, useState, useMemo, ReactNode, useEffect } from 'react';
import { Character, Message, Settings, View, ChatSession, GroupChatSession, World, Persona } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { DEFAULT_CHARACTER, DEFAULT_SETTINGS, DEFAULT_USER_PERSONA, GM_CHARACTER, GM_CHARACTER_ID } from '../constants';
import { useAppLogic } from './modules/useAppLogic';
import { useSettingsLogic } from './modules/useSettingsLogic';
import { useWorldLogic } from './modules/useWorldLogic';
import { useCharacterLogic } from './modules/useCharacterLogic';
import { useSessionLogic } from './modules/useSessionLogic';
import { useChatLogic } from './modules/useChatLogic';
import { logger } from '../services/logger';

// --- Context Type Definition ---

export interface AppContextType {
  // State
  characters: Character[];
  settings: Settings;
  worlds: World[];
  userPersona: Persona;
  conversations: Record<string, ChatSession[]>;
  groupConversations: Record<string, GroupChatSession>;
  currentView: View;
  activeCharacterId: string | null;
  activeSessionId: string | null;
  activeGroupSessionId: string | null;
  lastActiveSessionInfo: { type: 'single' | 'group', sessionId: string, characterId?: string } | null;
  isLoading: boolean;
  error: string | null;
  isConfirmationModalOpen: boolean;
  confirmationAction: { action: () => void; title: string; message: React.ReactNode; confirmText?: string; confirmVariant?: 'danger' | 'primary'; } | null;

  // Derived State
  activeCharacter: Character | null;
  activeSession: ChatSession | null;
  activeGroupSession: GroupChatSession | null;
  
  // Actions
  setCurrentView: (view: View) => void;
  stopGeneration: () => void;
  requestConfirmation: (action: () => void, title: string, message: React.ReactNode, confirmText?: string, confirmVariant?: 'danger' | 'primary') => void;
  handleConfirm: () => void;
  handleCloseConfirmation: () => void;

  // Chat Actions
  sendMessage: (content: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => void;
  regenerateResponse: () => Promise<void>;
  continueGeneration: () => Promise<void>;
  newSession: () => void;
  forkChat: (messageId: string) => void;
  startChat: (characterId: string) => void;
  selectSession: (characterId: string, sessionId: string) => void;
  deleteSession: (characterId: string, sessionId: string) => void;
  
  // Group Chat Actions
  sendGroupMessage: (content: string) => Promise<void>;
  editGroupMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteGroupMessage: (messageId: string) => void;
  regenerateGroupResponse: () => Promise<void>;
  continueGroupGeneration: () => Promise<void>;
  forkGroupChat: (messageId: string) => void;
  createGroupChat: (characterIds: string[], scenario: string) => void;
  selectGroupSession: (sessionId: string) => void;
  deleteGroupSession: (sessionId: string) => void;

  // Session Settings Actions
  setWorld: (worldId: string | null) => void;
  setTemperature: (temperature: number) => void;
  // FIX: Renamed `setReasoningEnabled` to `setThinkingEnabled` to match the correct property name in the type definitions.
  setThinkingEnabled: (enabled: boolean) => void;
  setContextSize: (contextSize: number) => void;
  setMaxOutputTokens: (maxOutputTokens: number) => void;
  setMemoryEnabled: (enabled: boolean) => void;

  // Character Actions
  saveCharacter: (character: Character) => void;
  deleteCharacter: (id: string) => void;
  duplicateCharacter: (id: string) => void;
  importCharacters: (characters: Character[]) => void;
  generateCharacterProfile: (concept: string) => Promise<Partial<Character>>;

  // Persona Actions
  savePersona: (persona: Persona) => void;

  // Settings Actions
  saveSettings: (settings: Settings) => void;

  // World Actions
  saveWorld: (world: World) => void;
  deleteWorld: (id: string) => void;

  // Debug
  getAppState: () => Record<string, unknown>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- State Management ---
  const [characters, setCharacters] = useLocalStorage<Character[]>('characters', [DEFAULT_CHARACTER]);
  const [conversations, setConversations] = useLocalStorage<Record<string, ChatSession[]>>('conversations', {});
  const [groupConversations, setGroupConversations] = useLocalStorage<Record<string, GroupChatSession>>('groupConversations', {});
  const [activeCharacterId, setActiveCharacterId] = useLocalStorage<string | null>('activeCharacterId', null);
  const [activeSessionId, setActiveSessionId] = useLocalStorage<string | null>('activeSessionId', null);
  const [activeGroupSessionId, setActiveGroupSessionId] = useLocalStorage<string | null>('activeGroupSessionId', null);
  const [lastActiveSessionInfo, setLastActiveSessionInfo] = useLocalStorage<{ type: 'single' | 'group', sessionId: string, characterId?: string } | null>('lastActiveSessionInfo', null);
  
  // --- Logic Modules ---
  const appLogic = useAppLogic();
  const settingsLogic = useSettingsLogic();
  const worldLogic = useWorldLogic({
    requestConfirmation: appLogic.requestConfirmation,
    setConversations, setGroupConversations,
    settings: settingsLogic.settings, setSettings: settingsLogic.setSettings
  });
  const characterLogic = useCharacterLogic({
    characters, setCharacters,
    requestConfirmation: appLogic.requestConfirmation,
    setConversations, setGroupConversations,
    activeCharacterId, setActiveCharacterId, setActiveSessionId, 
    setCurrentView: appLogic.setCurrentView,
    lastActiveSessionInfo, setLastActiveSessionInfo
  });
  const sessionLogic = useSessionLogic({
    characters, conversations, setConversations, groupConversations, setGroupConversations,
    activeCharacterId, setActiveCharacterId, activeSessionId, setActiveSessionId, activeGroupSessionId, setActiveGroupSessionId,
    setLastActiveSessionInfo, setCurrentView: appLogic.setCurrentView,
    requestConfirmation: appLogic.requestConfirmation,
    settings: settingsLogic.settings
  });
  const chatLogic = useChatLogic({
    settings: settingsLogic.settings,
    userPersona: settingsLogic.userPersona,
    worlds: worldLogic.worlds,
    characters,
    activeCharacterId,
    activeSession: sessionLogic.activeSession,
    activeGroupSession: sessionLogic.activeGroupSession,
    setConversations,
    setGroupConversations,
    requestConfirmation: appLogic.requestConfirmation,
  });

  // --- Derived State ---
  const activeCharacter = useMemo(() => characters.find(c => c.id === activeCharacterId) || null, [characters, activeCharacterId]);
  
  // --- Effects ---
  useEffect(() => {
    logger.log('App context initialized');
    setCharacters(prev => {
        const hasGM = prev.some(c => c.id === GM_CHARACTER_ID);
        if (hasGM) return prev.map(c => c.id === GM_CHARACTER_ID ? GM_CHARACTER : c);
        return [GM_CHARACTER, ...prev];
    });
  }, [setCharacters]);

  useEffect(() => {
    if ((appLogic.currentView === 'CHAT' && (!activeCharacter || !sessionLogic.activeSession)) || (appLogic.currentView === 'GROUP_CHAT' && !sessionLogic.activeGroupSession)) {
      logger.log('Invalid state for view, redirecting to CHARACTER_SELECTION', { 
          currentView: appLogic.currentView, activeCharacterId, activeSessionId, activeGroupSessionId 
      });
      appLogic.setCurrentView('CHARACTER_SELECTION');
      setActiveCharacterId(null);
      setActiveSessionId(null);
      setActiveGroupSessionId(null);
    }
  }, [appLogic.currentView, activeCharacter, sessionLogic.activeSession, sessionLogic.activeGroupSession, setActiveCharacterId, setActiveSessionId, setActiveGroupSessionId, activeCharacterId, activeSessionId, activeGroupSessionId, appLogic]);
  
  const getAppState = () => ({ 
    characters, conversations, groupConversations, worlds: worldLogic.worlds, 
    userPersona: settingsLogic.userPersona, settings: settingsLogic.settings, 
    currentView: appLogic.currentView, activeCharacterId, activeSessionId, activeGroupSessionId 
  });

  // --- Context Value ---
  const contextValue: AppContextType = {
    // State
    characters,
    conversations,
    groupConversations,
    lastActiveSessionInfo,
    ...settingsLogic,
    ...worldLogic,
    ...appLogic,
    ...sessionLogic,
    ...chatLogic,
    
    // Derived State
    activeCharacter,
    
    // Actions
    ...characterLogic,
    generateCharacterProfile: (concept) => chatLogic.generateCharacterProfile(concept, settingsLogic.settings),

    // Debug
    getAppState,
  };

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
