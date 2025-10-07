import React from 'react';
import { World, ChatSession, GroupChatSession, Settings } from '../../types';
import { useLocalStorage } from '../../hooks/useLocalStorage';

interface UseWorldLogicProps {
  requestConfirmation: (action: () => void, title: string, message: React.ReactNode, confirmText?: string, confirmVariant?: 'danger' | 'primary') => void;
  setConversations: React.Dispatch<React.SetStateAction<Record<string, ChatSession[]>>>;
  setGroupConversations: React.Dispatch<React.SetStateAction<Record<string, GroupChatSession>>>;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

export const useWorldLogic = ({ 
  requestConfirmation, setConversations, setGroupConversations, settings, setSettings 
}: UseWorldLogicProps) => {
  const [worlds, setWorlds] = useLocalStorage<World[]>('worlds', []);

  const saveWorld = (world: World) => {
    setWorlds(prev => {
      const existing = prev.find(w => w.id === world.id);
      if (existing) {
        return prev.map(w => w.id === world.id ? world : w);
      }
      return [...prev, world];
    });
  };

  const deleteWorld = (id: string) => {
    const worldToDelete = worlds.find(w => w.id === id); 
    if (!worldToDelete) return;
    
    // FIX: Replaced JSX with a template string to prevent syntax errors in a .ts file.
    requestConfirmation(() => {
        setWorlds(prev => prev.filter(w => w.id !== id));
        
        setConversations(prev => { 
          const newState = {...prev}; 
          Object.keys(newState).forEach(charId => { 
            newState[charId] = newState[charId].map(session => 
              session.worldId === id ? { ...session, worldId: null } : session
            ); 
          }); 
          return newState; 
        });

        setGroupConversations(prev => { 
          const newState = {...prev}; 
          Object.keys(newState).forEach(sessionId => { 
            if (newState[sessionId].worldId === id) {
              newState[sessionId] = { ...newState[sessionId], worldId: null };
            }
          }); 
          return newState; 
        });

        if (settings.worldId === id) {
          setSettings(prev => ({...prev, worldId: null}));
        }
    }, 'Delete World', `Are you sure you want to delete the world "${worldToDelete.name}"? This will unlink it from any chats, but will not delete the chats themselves.`, 'Delete World', 'danger');
  };

  return {
    worlds,
    saveWorld,
    deleteWorld,
  };
};