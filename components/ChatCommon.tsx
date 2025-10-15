import React from 'react';
import { Message } from '../types';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';

export const DateSeparator: React.FC<{ timestamp: number }> = ({
  timestamp,
}) => {
  const date = new Date(timestamp);
  const formattedDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
  }).format(date);
  return (
    <div className="relative my-4">
      <hr className="border-slate-700/50" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="bg-slate-900 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
          {formattedDate}
        </span>
      </div>
    </div>
  );
};

export const SystemMessage: React.FC<{ message: Message }> = ({ message }) => (
  <div className="flex justify-center items-center gap-3 my-4 text-xs text-slate-500 font-semibold animate-fade-in">
    <Icon name="brain" className="w-4 h-4" />
    <p>{message.content}</p>
  </div>
);

export const ActionButton: React.FC<{
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}> = ({ icon, label, onClick, disabled, className = '' }) => {
  return (
    <Tooltip content={label} position="top">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`p-1 text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-md transition-colors ${className}`}
        aria-label={label}
      >
        <Icon name={icon} className="w-4 h-4" />
      </button>
    </Tooltip>
  );
};
