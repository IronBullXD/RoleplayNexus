import React, { useState, useEffect, useReducer } from 'react';
import { logger, LogEntry, LogType } from '../services/logger';
import { Icon } from './Icon';
import { motion } from 'framer-motion';

interface DebugWindowProps {
  onClose: () => void;
  appState: Record<string, unknown>;
}

const LogLine: React.FC<{ entry: LogEntry }> = ({ entry }) => {
  const [isDataVisible, setIsDataVisible] = useState(false);
  const typeStyles: Record<LogType, { text: string; bg: string; border: string; }> = {
    INFO: { text: 'text-slate-400', bg: 'bg-slate-700', border: 'border-slate-600' },
    ERROR: { text: 'text-red-400', bg: 'bg-red-700', border: 'border-red-500/50' },
    API_REQUEST: { text: 'text-crimson-400', bg: 'bg-crimson-700', border: 'border-crimson-500/50' },
    API_RESPONSE: { text: 'text-emerald-400', bg: 'bg-emerald-700', border: 'border-emerald-500/50' },
    UI_EVENT: { text: 'text-ember-400', bg: 'bg-ember-700', border: 'border-ember-500/50' },
    STATE: { text: 'text-amber-400', bg: 'bg-amber-700', border: 'border-amber-500/50' },
  };
  const style = typeStyles[entry.type] || typeStyles.INFO;
  const formattedTime = entry.timestamp.toLocaleTimeString('en-US', {
    hour12: false,
  });
  const hasData = entry.data !== undefined && entry.data !== null;

  return (
    <div
      className={`p-2 border-b border-slate-800 font-mono text-sm ${style.text}`}
    >
      <div className="flex items-start gap-2">
        <span className="text-slate-500 shrink-0">{formattedTime}</span>
        <span className="font-semibold shrink-0 w-28 flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${style.bg}`}></div>
          [{entry.type}]
        </span>
        <p className="flex-1 whitespace-pre-wrap break-words">{entry.message}</p>
        {hasData && (
          <button
            onClick={() => setIsDataVisible(!isDataVisible)}
            className="p-1 text-slate-400 hover:text-white"
            aria-label={isDataVisible ? 'Collapse data' : 'Expand data'}
          >
            <Icon name={isDataVisible ? 'minus-square' : 'add'} className="w-4 h-4" />
          </button>
        )}
      </div>
      {isDataVisible && hasData && (
        <pre className={`mt-2 p-2 bg-slate-950 rounded-md text-xs overflow-x-auto border ${style.border}`}>
          <code>{JSON.stringify(entry.data, null, 2)}</code>
        </pre>
      )}
    </div>
  );
};

const LOG_TYPES: LogType[] = ['INFO', 'ERROR', 'API_REQUEST', 'API_RESPONSE', 'UI_EVENT', 'STATE'];

const FilterButton: React.FC<{ type: LogType, isActive: boolean, onClick: () => void }> = ({ type, isActive, onClick }) => {
    const typeStyles: Record<LogType, { text: string; bg: string; border: string; }> = {
    INFO: { text: 'text-slate-300', bg: 'bg-slate-700', border: 'border-slate-500' },
    ERROR: { text: 'text-red-300', bg: 'bg-red-700', border: 'border-red-500' },
    API_REQUEST: { text: 'text-crimson-300', bg: 'bg-crimson-700', border: 'border-crimson-500' },
    API_RESPONSE: { text: 'text-emerald-300', bg: 'bg-emerald-700', border: 'border-emerald-500' },
    UI_EVENT: { text: 'text-ember-300', bg: 'bg-ember-700', border: 'border-ember-500' },
    STATE: { text: 'text-amber-300', bg: 'bg-amber-700', border: 'border-amber-500' },
  };
  const style = typeStyles[type];
  
  return (
      <button 
          onClick={onClick}
          className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors border ${isActive ? `${style.bg} ${style.text} ${style.border}` : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
      >
          {type}
      </button>
  );
};


const DebugWindow: React.FC<DebugWindowProps> = ({
  onClose,
  appState,
}) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'state'>('logs');
  const [filters, setFilters] = useState<Set<LogType>>(new Set());
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    const listener = () => forceUpdate();
    logger.addListener(listener);
    return () => logger.removeListener(listener);
  }, []);

  const handleToggleFilter = (type: LogType) => {
    setFilters(prev => {
        const newSet = new Set(prev);
        if (newSet.has(type)) newSet.delete(type);
        else newSet.add(type);
        return newSet;
    });
  };

  const allLogs = logger.getLogs();
  const filteredLogs = filters.size > 0 ? allLogs.filter(log => filters.has(log.type)) : allLogs;

  const handleCopy = (content: unknown, type: string) => {
      let textToCopy = '';
      if (typeof content === 'string') {
          textToCopy = content;
      } else {
          try {
              textToCopy = JSON.stringify(content, null, 2);
          } catch (e) {
              logger.error(`Failed to copy ${type} to clipboard`, e);
              return;
          }
      }
      navigator.clipboard.writeText(textToCopy);
  }

  const handleCopyLogs = () => handleCopy(allLogs.map(log => `[${log.timestamp.toISOString()}] [${log.type}] ${log.message}` + (log.data ? `\n${JSON.stringify(log.data, null, 2)}` : '')).join('\n\n'), 'Logs');
  const handleCopyState = () => handleCopy(appState, 'State');
  const handleClearLogs = () => logger.clearLogs();

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
        aria-labelledby="debug-window-title"
        className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <Icon name="bug" className="w-6 h-6 text-crimson-400" />
            <h2 id="debug-window-title" className="text-xl font-bold font-display tracking-widest uppercase">
              Debug Console
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close debug console"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md"
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="p-2 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1 text-sm rounded-md ${
                activeTab === 'logs'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Logs
            </button>
            <button
              onClick={() => setActiveTab('state')}
              className={`px-3 py-1 text-sm rounded-md ${
                activeTab === 'state'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              App State
            </button>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === 'logs' ? (
            <div className="flex flex-col h-full">
              <div className="p-2 border-b border-slate-800 flex items-center justify-between shrink-0 sticky top-0 bg-slate-900/80 backdrop-blur-sm z-10">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-slate-400 mr-2">Filter:</span>
                  {LOG_TYPES.map(type => <FilterButton key={type} type={type} isActive={filters.has(type)} onClick={() => handleToggleFilter(type)} />)}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCopyLogs}
                        className="text-xs px-2 py-1 bg-slate-700 rounded hover:bg-slate-600"
                    >
                        Copy All
                    </button>
                    <button
                        onClick={handleClearLogs}
                        className="text-xs px-2 py-1 bg-slate-700 rounded hover:bg-slate-600"
                    >
                        Clear
                    </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredLogs.length > 0 ? (
                   [...filteredLogs].reverse().map((log, index) => (
                    <LogLine
                      key={`${log.timestamp.getTime()}-${index}`}
                      entry={log}
                    />
                  ))
                ) : (
                  <p className="p-4 text-slate-500 text-center">No logs matching filters.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-2 border-b border-slate-800 flex items-center gap-2 shrink-0">
                  <button onClick={handleCopyState} className="text-xs px-2 py-1 bg-slate-700 rounded hover:bg-slate-600">Copy State</button>
              </div>
              <pre className="p-4 text-xs overflow-auto flex-1">
                <code>{JSON.stringify(appState, null, 2)}</code>
              </pre>
            </div>
          )}
        </main>
      </motion.div>
    </motion.div>
  );
};

export default DebugWindow;