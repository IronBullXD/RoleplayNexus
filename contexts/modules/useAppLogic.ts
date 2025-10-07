import { useState, useCallback, ReactNode } from 'react';
import { View } from '../../types';
import { logger } from '../../services/logger';

export const useAppLogic = () => {
  const [currentView, setCurrentView] = useState<View>('CHARACTER_SELECTION');
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<{ action: () => void; title: string; message: ReactNode; confirmText?: string; confirmVariant?: 'danger' | 'primary'; } | null>(null);

  const requestConfirmation = useCallback((action: () => void, title: string, message: ReactNode, confirmText = 'Confirm', confirmVariant: 'danger' | 'primary' = 'primary') => {
      logger.uiEvent('Confirmation requested', { title });
      setConfirmationAction({ action, title, message, confirmText, confirmVariant });
      setIsConfirmationModalOpen(true);
  }, []);
  
  const handleConfirm = () => {
    if (confirmationAction) {
        logger.uiEvent('Confirmation accepted', { title: confirmationAction.title });
        confirmationAction.action();
    }
    setIsConfirmationModalOpen(false);
    setConfirmationAction(null);
  }

  const handleCloseConfirmation = () => {
    if (confirmationAction) {
        logger.uiEvent('Confirmation dismissed', { title: confirmationAction.title });
    }
    setIsConfirmationModalOpen(false);
    setConfirmationAction(null);
  }

  return {
    currentView,
    setCurrentView,
    isConfirmationModalOpen,
    confirmationAction,
    requestConfirmation,
    handleConfirm,
    handleCloseConfirmation,
  };
};
