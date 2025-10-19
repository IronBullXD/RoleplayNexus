import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ReactNode } from 'react';
import { View } from '../../types';
import { logger } from '../../services/logger';

type ConfirmationAction = {
  action: () => void;
  title: string;
  message: ReactNode;
  confirmText?: string;
  confirmVariant?: 'danger' | 'primary';
} | null;

export interface UIState {
  currentView: View;
  isLoading: boolean;
  error: string | null;
  isConfirmationModalOpen: boolean;
  confirmationAction: ConfirmationAction;
  isInitialized: boolean;
  activeCharacterId: string | null;
  activeSessionId: string | null;
  activeGroupSessionId: string | null;
  abortController: AbortController | null;
  isSelectionModeActive: boolean;
  selectedMessageIds: string[];
}

export interface UIActions {
  setCurrentView: (view: View) => void;
  requestConfirmation: (
    action: () => void,
    title: string,
    message: ReactNode,
    confirmText?: string,
    confirmVariant?: 'danger' | 'primary',
  ) => void;
  handleConfirm: () => void;
  handleCloseConfirmation: () => void;
  resetChatView: () => void;
  stopGeneration: () => void;
  setError: (error: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setActiveCharacterId: (id: string | null) => void;
  setActiveSessionId: (id: string | null) => void;
  setActiveGroupSessionId: (id: string | null) => void;
  setAbortController: (controller: AbortController | null) => void;
  setInitialized: (initialized: boolean) => void;
  toggleSelectionMode: () => void;
  toggleMessageSelection: (messageId: string) => void;
  clearMessageSelection: () => void;
}

export type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // --- Initial State ---
      currentView: 'CHARACTER_SELECTION',
      isLoading: false,
      error: null,
      isConfirmationModalOpen: false,
      confirmationAction: null,
      isInitialized: false,
      activeCharacterId: null,
      activeSessionId: null,
      activeGroupSessionId: null,
      abortController: null,
      isSelectionModeActive: false,
      selectedMessageIds: [],

      // --- Actions ---
      setInitialized: (initialized) => set({ isInitialized: initialized }),
      setCurrentView: (view) => set({ currentView: view }),
      setActiveCharacterId: (id) => set({ activeCharacterId: id }),
      setActiveSessionId: (id) => set({ activeSessionId: id }),
      setActiveGroupSessionId: (id) => set({ activeGroupSessionId: id }),
      setAbortController: (controller) => set({ abortController: controller }),

      resetChatView: () => {
        set({
          currentView: 'CHARACTER_SELECTION',
          activeCharacterId: null,
          activeSessionId: null,
          activeGroupSessionId: null,
          isSelectionModeActive: false,
          selectedMessageIds: [],
        });
      },

      requestConfirmation: (
        action,
        title,
        message,
        confirmText = 'Confirm',
        confirmVariant = 'primary',
      ) => {
        logger.uiEvent('Confirmation requested', { title });
        set({
          isConfirmationModalOpen: true,
          confirmationAction: { action, title, message, confirmText, confirmVariant },
        });
      },

      handleConfirm: () => {
        const { confirmationAction } = get();
        if (confirmationAction) {
          logger.uiEvent('Confirmation accepted', { title: confirmationAction.title });
          confirmationAction.action();
        }
        set({ isConfirmationModalOpen: false, confirmationAction: null });
      },

      handleCloseConfirmation: () => {
        const { confirmationAction } = get();
        if (confirmationAction)
          logger.uiEvent('Confirmation dismissed', { title: confirmationAction.title });
        set({ isConfirmationModalOpen: false, confirmationAction: null });
      },

      stopGeneration: () => {
        const { abortController } = get();
        if (abortController) {
          logger.uiEvent('Stop generation requested by user');
          abortController.abort();
          set({ abortController: null });
        }
        if (get().isLoading) set({ isLoading: false });
      },
      
      setError: (error: string | null) => set({ error }),
      setIsLoading: (isLoading: boolean) => set({ isLoading }),
      
      toggleSelectionMode: () => set(state => ({
          isSelectionModeActive: !state.isSelectionModeActive,
          selectedMessageIds: [], // Always clear selection when toggling mode
      })),
      toggleMessageSelection: (messageId) => set(state => {
          const newSelection = new Set(state.selectedMessageIds);
          if (newSelection.has(messageId)) {
              newSelection.delete(messageId);
          } else {
              newSelection.add(messageId);
          }
          return { selectedMessageIds: Array.from(newSelection) };
      }),
      clearMessageSelection: () => set({ selectedMessageIds: [] }),
    }),
    {
      name: 'roleplay-nexus-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeCharacterId: state.activeCharacterId,
        activeSessionId: state.activeSessionId,
        activeGroupSessionId: state.activeGroupSessionId,
      }),
    }
  )
);
