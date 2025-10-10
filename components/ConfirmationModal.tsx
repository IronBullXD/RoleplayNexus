import React from 'react';
import { Icon } from './Icon';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmButtonText?: string;
  confirmButtonVariant?: 'danger' | 'primary';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = 'Confirm',
  confirmButtonVariant = 'primary',
}) => {
  if (!isOpen) return null;

  const confirmButtonClasses = {
    primary: 'bg-sky-600 hover:bg-sky-500 border-sky-400/50 shadow-sky-900/50',
    danger: 'bg-fuchsia-600 hover:bg-fuchsia-500 border-fuchsia-400/50 shadow-fuchsia-900/50',
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-md m-4 border border-slate-700 animate-slide-up" onClick={e => e.stopPropagation()}>
        <header className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-bold font-display tracking-widest uppercase">{title}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md">
            <Icon name="close" />
          </button>
        </header>

        <main className="p-6">
          <div className="text-slate-300">{message}</div>
        </main>

        <footer className="p-4 border-t border-slate-800 flex justify-end space-x-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 border border-slate-600 hover:bg-slate-700 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white ${confirmButtonClasses[confirmButtonVariant || 'primary']} rounded-lg transition-colors border shadow-md`}
          >
            {confirmButtonText}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ConfirmationModal;