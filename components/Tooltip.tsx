import React from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: 'top' | 'bottom';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', className = '' }) => {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  };
  
  const arrowClasses = {
      top: 'top-full left-1/2 -translate-x-1/2 border-x-transparent border-t-slate-800',
      bottom: 'bottom-full left-1/2 -translate-x-1/2 border-x-transparent border-b-slate-800',
  };

  const animationClasses = {
      top: 'origin-bottom translate-y-1',
      bottom: 'origin-top -translate-y-1',
  };

  if (!content) return children;

  return (
    <div className="relative inline-flex group">
      {children}
      <div
        role="tooltip"
        className={`absolute z-50 px-2.5 py-1.5 text-xs font-semibold text-slate-100 bg-slate-800 border border-slate-700/50 rounded-md shadow-lg whitespace-nowrap 
                   opacity-0 group-hover:opacity-100 group-focus-within:opacity-100
                   ${animationClasses[position]} group-hover:translate-y-0 group-focus-within:translate-y-0
                   transition-all duration-200 delay-300 pointer-events-none
                   ${positionClasses[position]} ${className}`}
      >
        {content}
        <div className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}></div>
      </div>
    </div>
  );
};
