import React, { useMemo, useCallback } from 'react';
import { Character, ChatSession, GroupChatSession, Settings, View } from '../../types';

type LastActiveSessionInfo = { type: 'single' | 'group', sessionId: string, characterId?: string };

interface UseSessionLogicProps {
  characters: Character[];
  conversations: Record<string, ChatSession[]>;
  setConversations: React.Dispatch<React.SetStateAction<Record<string, ChatSession[]>>>;
  groupConversations: Record<string, GroupChatSession>;
  setGroupConversations: React.Dispatch<React.SetStateAction<Record<string, GroupChatSession>>>;
  activeCharacterId: string | null;
  setActiveCharacterId: React.Dispatch<React.SetStateAction<string | null>>;
  activeSessionId: string | null;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  activeGroupSessionId: string | null;
  setActiveGroupSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  setLastActiveSessionInfo: React.Dispatch<React.SetStateAction<LastActiveSessionInfo | null>>;
  setCurrentView: (view: View) => void;
  requestConfirmation: (action: () => void, title: string, message: React.ReactNode, confirmText?: string, confirmVariant?: 'danger' | 'primary') => void;
  settings: Settings;
}

export const useSessionLogic = ({
  characters, conversations, setConversations, groupConversations, setGroupConversations,
  activeCharacterId, setActiveCharacterId, activeSessionId, setActiveSessionId,
  activeGroupSessionId, setActiveGroupSessionId, setLastActiveSessionInfo,
  setCurrentView, requestConfirmation, settings
}: UseSessionLogicProps) => {

  const activeSession = useMemo(() => conversations[activeCharacterId || '']?.find(s => s.id === activeSessionId) || null, [conversations, activeCharacterId, activeSessionId]);
  const activeGroupSession = useMemo(() => groupConversations[activeGroupSessionId || ''] || null, [groupConversations, activeGroupSessionId]);

  const newSession = useCallback(() => {
    if (!activeCharacterId) return;
    const character = characters.find(c => c.id === activeCharacterId);
    if (!character) return;
    const newSessionData: ChatSession = { 
      id: crypto.randomUUID(), 
      title: `New Chat - ${new Date().toLocaleString()}`, 
      messages: [], 
      worldId: settings.worldId,
      temperature: settings.temperature,
      reasoningEnabled: settings.reasoningEnabled,
      contextSize: settings.contextSize,
      maxOutputTokens: settings.maxOutputTokens,
      memoryEnabled: false,
    };
    if (character.greeting) newSessionData.messages.push({ id: crypto.randomUUID(), role: 'assistant', content: character.greeting, timestamp: Date.now() });
    setConversations(prev => ({ ...prev, [activeCharacterId]: [...(prev[activeCharacterId] || []), newSessionData] }));
    setActiveSessionId(newSessionData.id);
    setLastActiveSessionInfo({ type: 'single', characterId: activeCharacterId, sessionId: newSessionData.id });
  }, [activeCharacterId, characters, setConversations, setActiveSessionId, setLastActiveSessionInfo, settings]);
  
  const startChat = (id: string) => {
    const character = characters.find(c => c.id === id);
    if (!character) return;
    const existingSessions = conversations[id];
    if (existingSessions && existingSessions.length > 0) {
      // Find the most recent session
      const mostRecentSession = existingSessions.reduce((latest, current) => {
        const latestTimestamp = latest.messages[latest.messages.length - 1]?.timestamp || 0;
        const currentTimestamp = current.messages[current.messages.length - 1]?.timestamp || 0;
        return currentTimestamp > latestTimestamp ? current : latest;
      });
      selectSession(id, mostRecentSession.id);
      return;
    }

    const newSessionData: ChatSession = { 
        id: crypto.randomUUID(), 
        title: `New Chat - ${new Date().toLocaleString()}`, 
        messages: [], 
        worldId: settings.worldId,
        temperature: settings.temperature,
        reasoningEnabled: settings.reasoningEnabled,
        contextSize: settings.contextSize,
        maxOutputTokens: settings.maxOutputTokens,
        memoryEnabled: false,
    };
    if (character.greeting) newSessionData.messages.push({ id: crypto.randomUUID(), role: 'assistant', content: character.greeting, timestamp: Date.now() });
    setConversations(prev => ({ ...prev, [id]: [...(prev[id] || []), newSessionData] }));
    setActiveCharacterId(id);
    setActiveSessionId(newSessionData.id);
    setLastActiveSessionInfo({ type: 'single', characterId: id, sessionId: newSessionData.id });
    setCurrentView('CHAT');
  };

  const forkChat = useCallback((messageId: string) => {
    const character = characters.find(c => c.id === activeCharacterId);
    if (!character || !activeSession) return;
    const messageIndex = activeSession.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    const newSessionData: ChatSession = { ...activeSession, id: crypto.randomUUID(), title: `${activeSession.title} (Fork)`, messages: activeSession.messages.slice(0, messageIndex + 1) };
    setConversations(prev => ({ ...prev, [character.id]: [...(prev[character.id] || []), newSessionData] }));
    setActiveSessionId(newSessionData.id);
    setLastActiveSessionInfo({ type: 'single', characterId: character.id, sessionId: newSessionData.id });
    setCurrentView('CHAT');
  }, [activeCharacterId, characters, activeSession, setConversations, setActiveSessionId, setLastActiveSessionInfo, setCurrentView]);

  const selectSession = (characterId: string, sessionId: string) => {
    setActiveCharacterId(characterId);
    setActiveSessionId(sessionId);
    setLastActiveSessionInfo({ type: 'single', characterId, sessionId });
    setCurrentView('CHAT');
  };
  
  const deleteSession = (characterId: string, sessionId: string) => {
    const char = characters.find(c => c.id === characterId);
    const session = conversations[characterId]?.find(s => s.id === sessionId);
    if (!char || !session) return;
    // FIX: Replaced JSX with a template string to prevent syntax errors in a .ts file.
    requestConfirmation(() => {
      setConversations(prev => {
          const newConvos = { ...prev };
          newConvos[characterId] = (newConvos[characterId] || []).filter(s => s.id !== sessionId);
          if (newConvos[characterId].length === 0) delete newConvos[characterId];
          return newConvos;
      });
    }, 'Delete Chat History', `Are you sure you want to delete the chat "${session.title}" with "${char.name}"? This cannot be undone.`, 'Delete', 'danger');
  };

  const forkGroupChat = useCallback((messageId: string) => {
    if (!activeGroupSession) return;
    const messageIndex = activeGroupSession.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    const newSessionData: GroupChatSession = { ...activeGroupSession, id: crypto.randomUUID(), title: `${activeGroupSession.title} (Fork)`, messages: activeGroupSession.messages.slice(0, messageIndex + 1) };
    setGroupConversations(prev => ({ ...prev, [newSessionData.id]: newSessionData }));
    setActiveGroupSessionId(newSessionData.id);
    setLastActiveSessionInfo({ type: 'group', sessionId: newSessionData.id });
    setCurrentView('GROUP_CHAT');
  }, [activeGroupSession, setGroupConversations, setActiveGroupSessionId, setLastActiveSessionInfo, setCurrentView]);
  
  const createGroupChat = (characterIds: string[], scenario: string) => {
    if (characterIds.length < 2 || !scenario.trim()) return;
    const participatingCharacters = characters.filter(c => characterIds.includes(c.id));
    const title = participatingCharacters.map(c => c.name).slice(0, 3).join(', ') + (participatingCharacters.length > 3 ? '...' : '');
    const newSessionData: GroupChatSession = { 
        id: crypto.randomUUID(), 
        title, 
        characterIds, 
        scenario, 
        messages: [], 
        worldId: settings.worldId,
        temperature: settings.temperature,
        reasoningEnabled: settings.reasoningEnabled,
        contextSize: settings.contextSize,
        maxOutputTokens: settings.maxOutputTokens,
        memoryEnabled: false,
    };
    setGroupConversations(prev => ({ ...prev, [newSessionData.id]: newSessionData }));
    setActiveGroupSessionId(newSessionData.id);
    setLastActiveSessionInfo({ type: 'group', sessionId: newSessionData.id });
    setCurrentView('GROUP_CHAT');
  };

  const selectGroupSession = (sessionId: string) => {
    setActiveGroupSessionId(sessionId);
    setLastActiveSessionInfo({ type: 'group', sessionId });
    setCurrentView('GROUP_CHAT');
  };

  const deleteGroupSession = (sessionId: string) => {
    const session = groupConversations[sessionId];
    if (!session) return;
    // FIX: Replaced JSX with a template string to prevent syntax errors in a .ts file.
    requestConfirmation(() => {
        setGroupConversations(prev => { const newState = {...prev}; delete newState[sessionId]; return newState; });
    }, 'Delete Group Chat', `Are you sure you want to delete the group chat "${session.title}"? This cannot be undone.`, 'Delete', 'danger');
  };

  const updateActiveSessionSettings = useCallback((update: Partial<ChatSession & GroupChatSession>) => {
      if (activeCharacterId && activeSessionId) {
          setConversations(prev => ({
              ...prev,
              [activeCharacterId]: (prev[activeCharacterId] || []).map(s => s.id === activeSessionId ? { ...s, ...update } : s),
          }));
      } else if (activeGroupSessionId) {
          setGroupConversations(prev => {
              const groupSession = prev[activeGroupSessionId];
              if (!groupSession) return prev;
              return { ...prev, [activeGroupSessionId]: { ...groupSession, ...update } };
          });
      }
  }, [activeCharacterId, activeSessionId, activeGroupSessionId, setConversations, setGroupConversations]);

  const setWorld = useCallback((worldId: string | null) => updateActiveSessionSettings({ worldId }), [updateActiveSessionSettings]);
  const setTemperature = useCallback((temperature: number) => updateActiveSessionSettings({ temperature }), [updateActiveSessionSettings]);
  const setReasoningEnabled = useCallback((enabled: boolean) => updateActiveSessionSettings({ reasoningEnabled: enabled }), [updateActiveSessionSettings]);
  const setContextSize = useCallback((contextSize: number) => updateActiveSessionSettings({ contextSize }), [updateActiveSessionSettings]);
  const setMaxOutputTokens = useCallback((maxOutputTokens: number) => updateActiveSessionSettings({ maxOutputTokens }), [updateActiveSessionSettings]);
  const setMemoryEnabled = useCallback((enabled: boolean) => updateActiveSessionSettings({ memoryEnabled: enabled }), [updateActiveSessionSettings]);


  return {
    activeSession,
    activeGroupSession,
    activeCharacterId,
    activeSessionId,
    activeGroupSessionId,
    newSession,
    startChat,
    forkChat,
    selectSession,
    deleteSession,
    createGroupChat,
    forkGroupChat,
    selectGroupSession,
    deleteGroupSession,
    setWorld,
    setTemperature,
    setReasoningEnabled,
    setContextSize,
    setMaxOutputTokens,
    setMemoryEnabled,
  };
};