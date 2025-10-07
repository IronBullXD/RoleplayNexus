import { useState, useCallback } from 'react';
import { Message } from '../types';

/**
 * A hook to manage the state for editing a single message within a list.
 * @param onEdit - Callback function to execute when an edit is saved.
 * It receives the message ID and the new content.
 */
export const useMessageEditing = (onEdit: (messageId: string, newContent: string) => void) => {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState<string>('');
  const [editingText, setEditingText] = useState<string>('');

  /**
   * Starts the editing process for a given message.
   * @param message - The message object to be edited.
   */
  const startEditing = useCallback((message: Message) => {
    setEditingMessageId(message.id);
    setOriginalText(message.content);
    setEditingText(message.content);
  }, []);

  /**
   * Cancels the current editing process and discards any changes.
   */
  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setOriginalText('');
    setEditingText('');
  }, []);

  /**
   * Saves the current edit. It calls the onEdit callback if the content has changed.
   * After saving, it resets the editing state.
   */
  const saveEdit = useCallback(() => {
    if (editingMessageId && editingText.trim() && editingText.trim() !== originalText) {
      onEdit(editingMessageId, editingText.trim());
    }
    // Always reset state, regardless of whether content changed, to exit editing mode.
    cancelEdit();
  }, [editingMessageId, editingText, originalText, onEdit, cancelEdit]);

  return {
    editingMessageId,
    editingText,
    setEditingText,
    startEditing,
    saveEdit,
    cancelEdit,
  };
};
