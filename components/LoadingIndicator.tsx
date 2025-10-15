import React from 'react';
import { Icon } from './Icon';

const LoadingIndicator: React.FC<{ message?: string; fullscreen?: boolean }> = ({ message = 'Loading View...', fullscreen = false }) => {
  const containerClasses = fullscreen
    ? 'fixed inset-0 flex flex-col items-center justify-center bg-slate-950 z-[100]'
    : 'w-full h-full flex flex-col items-center justify-center text-slate-300 p-8';

  return (
    <div className={containerClasses}>
      <Icon name="redo" className="w-10 h-10 text-crimson-400 animate-spin" />
      {message && <p className="mt-4 text-lg font-display tracking-wider uppercase">{message}</p>}
    </div>
  );
};

export default LoadingIndicator;
