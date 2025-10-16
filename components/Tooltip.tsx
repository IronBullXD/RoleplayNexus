import React, { useState, useEffect } from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: 'top' | 'bottom';
  className?: string;
  onShow?: () => void;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', className = '', onShow }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showTimeout, setShowTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

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

  // Hide tooltip when any modal opens (listen for escape key or focus changes)
  useEffect(() => {
    const handleModalOpen = () => {
      setIsVisible(false);
      if (showTimeout) {
        clearTimeout(showTimeout);
        setShowTimeout(null);
      }
    };

    // Listen for escape key (commonly used to close modals)
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleModalOpen();
      }
    };

    // Listen for focus changes that might indicate modal opening
    const handleFocusChange = () => {
      // Check if focus moved to a modal element
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.closest('[role="dialog"]') ||
        activeElement.closest('.fixed') ||
        activeElement.closest('[data-modal]')
      )) {
        handleModalOpen();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('focusin', handleFocusChange);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('focusin', handleFocusChange);
      if (showTimeout) {
        clearTimeout(showTimeout);
      }
    };
  }, [showTimeout]);

  const handleMouseEnter = () => {
    if (onShow) onShow();
    
    // Clear any existing timeout
    if (showTimeout) {
      clearTimeout(showTimeout);
    }

    // Set a delay before showing
    const timeout = setTimeout(() => {
      setIsVisible(true);
      setShowTimeout(null);
    }, 300);

    setShowTimeout(timeout);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
    if (showTimeout) {
      clearTimeout(showTimeout);
      setShowTimeout(null);
    }
  };

  if (!content) return children;

  return (
    <div 
      className="relative inline-flex" 
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <div
        role="tooltip"
        className={`absolute z-50 px-2.5 py-1.5 text-xs font-semibold text-slate-100 bg-slate-800 border border-slate-700/50 rounded-md shadow-lg whitespace-nowrap 
                   transition-all duration-200 pointer-events-none
                   ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0'}
                   ${animationClasses[position]}
                   ${positionClasses[position]} ${className}`}
      >
        {content}
        <div className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}></div>
      </div>
    </div>
  );
};
