import React from 'react';
import { Icon } from './Icon';
import { motion } from 'framer-motion';

interface ConfirmationModalProps {
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmButtonText?: string;
  confirmButtonVariant?: 'danger' | 'primary';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = 'Confirm',
  confirmButtonVariant = 'primary',
}) => {
  const confirmButtonClasses = {
    primary:
      'bg-crimson-600 hover:bg-crimson-500 border-crimson-400/50 shadow-crimson-900/50',
    danger:
      'bg-ember-600 hover:bg-ember-500 border-ember-400/50 shadow-ember-900/50',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-md m-4 border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h2 id="confirmation-modal-title" className="text-xl font-bold font-display tracking-widest uppercase">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close confirmation"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md"
          >
            <Icon name="close" />
          </button>
        </header>

        <main className="p-6">
          <div className="text-slate-300">{message}</div>
        </main>

        <footer className="p-4 border-t border-slate-800 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 border border-slate-600 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white ${
              confirmButtonClasses[confirmButtonVariant || 'primary']
            } rounded-lg transition-colors border shadow-md`}
          >
            {confirmButtonText}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
};

export default ConfirmationModal;