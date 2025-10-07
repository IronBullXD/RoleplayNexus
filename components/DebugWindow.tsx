import React, { useState, useEffect, useReducer } from 'react';
import { logger, LogEntry } from '../services/logger';
import { Icon } from './Icon';

interface DebugWindowProps {
  isOpen: boolean;
  onClose: () => void;
  appState: Record<string, unknown>;
}

const LogLine: React.FC<{ entry: LogEntry }> = ({ entry }) => {
    const [isDataVisible, setIsDataVisible] = useState(false);
    const typeColors: Record<string, string> = { INFO: 'text-slate-400', ERROR: 'text-red-400', API_REQUEST: 'text-sky-400', API_RESPONSE: 'text-emerald-400', UI_EVENT: 'text-violet-400' };
    const formattedTime = entry.timestamp.toLocaleTimeString('en-US', { hour12: false });
    const hasData = entry.data !== undefined && entry.data !== null;

    return (
        <div className={`p-2 border-b border-slate-800 font-mono text-sm ${typeColors[entry.type] || 'text-slate-300'}`}>
            <div className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0">{formattedTime}</span>
                <span className={`font-semibold shrink-0 w-28`}>[{entry.type}]</span>
                <p className="flex-1 whitespace-pre-wrap break-words">{entry.message}</p>
                {hasData && <button onClick={() => setIsDataVisible(!isDataVisible)} className="p-1 text-slate-400 hover:text-white"><Icon name={isDataVisible ? 'close' : 'add'} className="w-4 h-4" /></button>}
            </div>
            {isDataVisible && hasData && <pre className="mt-2 p-2 bg-slate-950 rounded-md text-xs overflow-x-auto"><code>{JSON.stringify(entry.data, null, 2)}</code></pre>}
        </div>
    );
};

const DebugWindow: React.FC<DebugWindowProps> = ({ isOpen, onClose, appState }) => {
    const [activeTab, setActiveTab] = useState<'logs' | 'state'>('logs');
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    useEffect(() => {
        if (!isOpen) return;
        const listener = () => forceUpdate();
        logger.addListener(listener);
        return () => logger.removeListener(listener);
    }, [isOpen]);

    if (!isOpen) return null;

    const logs = logger.getLogs();
    const handleCopyLogs = () => navigator.clipboard.writeText(logs.map(log => `[${log.timestamp.toISOString()}] [${log.type}] ${log.message}` + (log.data ? `\n${JSON.stringify(log.data, null, 2)}` : '')).join('\n\n'));
    const handleClearLogs = () => logger.clearLogs();

    return (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col border border-slate-700 animate-slide-up" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3"><Icon name="bug" className="w-6 h-6 text-sky-400" /><h2 className="text-xl font-bold font-display tracking-widest uppercase">Debug Console</h2></div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md"><Icon name="close" /></button>
                </header>
                <div className="p-2 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setActiveTab('logs')} className={`px-3 py-1 text-sm rounded-md ${activeTab === 'logs' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>Logs</button>
                        <button onClick={() => setActiveTab('state')} className={`px-3 py-1 text-sm rounded-md ${activeTab === 'state' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>Application State</button>
                    </div>
                </div>
                <main className="flex-1 overflow-y-auto custom-scrollbar">
                    {activeTab === 'logs' ? (
                        <div>{logs.length > 0 ? [...logs].reverse().map((log, i) => <LogLine key={logs.length - 1 - i} entry={log} />) : <p className="p-4 text-slate-500">No logs yet.</p>}</div>
                    ) : ( <pre className="p-4 text-xs"><code>{JSON.stringify(appState, null, 2)}</code></pre> )}
                </main>
                <footer className="p-3 border-t border-slate-800 flex justify-end items-center shrink-0">
                    <div className="flex gap-2">
                        <button onClick={handleCopyLogs} className="px-3 py-1.5 text-sm font-semibold text-slate-300 bg-slate-700/50 border border-slate-600 hover:bg-slate-700 rounded-lg transition-colors">Copy Logs</button>
                        <button onClick={handleClearLogs} className="px-3 py-1.5 text-sm font-semibold text-slate-300 bg-slate-700/50 border border-slate-600 hover:bg-slate-700 rounded-lg transition-colors">Clear Logs</button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default DebugWindow;
