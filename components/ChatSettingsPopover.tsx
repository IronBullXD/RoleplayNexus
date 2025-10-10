import React, { useState, useRef, useEffect } from 'react';
import { World, Settings, PromptAdherence } from '../types';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';

interface ChatSettingsPopoverProps {
    settings: Pick<Settings, 'worldId' | 'temperature' | 'thinkingEnabled' | 'contextSize' | 'maxOutputTokens' | 'promptAdherence'> & { memoryEnabled: boolean };
    worlds: World[];
    onSetWorld: (worldId: string | null) => void;
    onSetTemperature: (temperature: number) => void;
    onSetThinkingEnabled: (enabled: boolean) => void;
    onSetContextSize: (size: number) => void;
    onSetMaxOutputTokens: (tokens: number) => void;
    onSetMemoryEnabled: (enabled: boolean) => void;
    onSetPromptAdherence: (adherence: PromptAdherence) => void;
}

const ChatSettingsPopover: React.FC<ChatSettingsPopoverProps> = ({ settings, worlds, onSetWorld, onSetTemperature, onSetThinkingEnabled, onSetContextSize, onSetMaxOutputTokens, onSetMemoryEnabled, onSetPromptAdherence }) => {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={popoverRef}>
             <Tooltip content="Chat Settings" position="bottom">
                <button
                    type="button"
                    onClick={() => setIsOpen(p => !p)}
                    aria-expanded={isOpen}
                    className="p-2 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 text-slate-300 bg-slate-800/50 hover:bg-slate-700/50"
                    aria-label="Chat Settings"
                >
                    <Icon name="sliders" className="w-5 h-5" />
                </button>
            </Tooltip>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-lg shadow-2xl z-20 p-5 animate-fade-in space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                        <Icon name="sliders" className="w-5 h-5 text-slate-400" />
                        <h4 className="text-md font-bold text-slate-100 font-display tracking-wider uppercase">Chat Settings</h4>
                    </div>

                    <hr className="border-slate-800" />

                    {/* World Lore */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300">World Lore</label>
                        <p className="text-xs text-slate-500 mb-2">Provide context & consistency from a worldbook.</p>
                        <select
                            value={settings.worldId || ''}
                            onChange={(e) => onSetWorld(e.target.value || null)}
                            className="block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm p-2"
                        >
                            <option value="">None</option>
                            {worlds.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                    
                    {/* Creativity */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300">Creativity</label>
                        <p className="text-xs text-slate-500 mb-2">Controls randomness. Lower is more predictable.</p>
                        <div className="flex items-center gap-3">
                            <input
                                type="range" min="0" max="2" step="0.1"
                                value={settings.temperature}
                                onChange={e => onSetTemperature(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                            />
                            <span className="font-mono text-sm text-slate-300 bg-slate-950 border border-slate-700 px-2 py-1 rounded-md w-14 text-center">
                                {settings.temperature.toFixed(1)}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 mt-1 px-1">
                            <span>Precise</span>
                            <span>Creative</span>
                        </div>
                    </div>
                    
                    {/* Memory & Response Length */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Memory (Tokens)</label>
                            <p className="text-xs text-slate-500 mb-2">How much the AI remembers from the conversation history.</p>
                            <input
                                key={`context-size-${settings.contextSize}`}
                                type="number"
                                defaultValue={settings.contextSize}
                                onBlur={(e) => onSetContextSize(parseInt(e.target.value, 10) || 0)}
                                className="block w-full bg-slate-950 border-2 border-slate-700 rounded-lg p-2 text-sm"
                                min="0" step="512"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Response Length (Tokens)</label>
                            <p className="text-xs text-slate-500 mb-2">The maximum length of the AI's reply.</p>
                            <input
                                key={`max-tokens-${settings.maxOutputTokens}`}
                                type="number"
                                defaultValue={settings.maxOutputTokens}
                                onBlur={(e) => onSetMaxOutputTokens(parseInt(e.target.value, 10) || 0)}
                                className="block w-full bg-slate-950 border-2 border-slate-700 rounded-lg p-2 text-sm"
                                min="0" step="256"
                            />
                        </div>
                    </div>
                    
                    {/* Prompt Adherence */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300">Prompt Adherence</label>
                        <p className="text-xs text-slate-500 mb-2">"Strict" mode repeats key rules to improve AI focus.</p>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-800 rounded-lg">
                            <button type="button" onClick={() => onSetPromptAdherence('default')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${settings.promptAdherence === 'default' ? 'bg-sky-600 text-white shadow' : 'text-slate-300 hover:bg-slate-700'}`}>
                                Default
                            </button>
                            <button type="button" onClick={() => onSetPromptAdherence('strict')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${settings.promptAdherence === 'strict' ? 'bg-sky-600 text-white shadow' : 'text-slate-300 hover:bg-slate-700'}`}>
                                Strict
                            </button>
                        </div>
                    </div>
                    
                    <hr className="!my-4 border-slate-800" />
                    
                    {/* Feature Toggles */}
                     <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Icon name="brain" className="w-6 h-6 text-slate-400 shrink-0" />
                                <div>
                                    <label className="block text-sm font-medium text-slate-300">Enable AI Thinking</label>
                                    <p className="text-xs text-slate-500">Reveals the AI's thought process.</p>
                                </div>
                            </div>
                            <button type="button" role="switch" aria-checked={settings.thinkingEnabled} onClick={() => onSetThinkingEnabled(!settings.thinkingEnabled)} className={`relative inline-flex items-center h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${settings.thinkingEnabled ? 'bg-sky-500' : 'bg-slate-700'}`}>
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out ${settings.thinkingEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <div className="flex justify-between items-center">
                             <div className="flex items-center gap-3">
                                 <Icon name="book-open" className="w-6 h-6 text-slate-400 shrink-0" />
                                 <div>
                                     <label className="block text-sm font-medium text-slate-300">Auto-Summarize Memory</label>
                                     <p className="text-xs text-slate-500">Summarizes old messages to prevent the AI from forgetting.</p>
                                 </div>
                             </div>
                             <button type="button" role="switch" aria-checked={settings.memoryEnabled} onClick={() => onSetMemoryEnabled(!settings.memoryEnabled)} className={`relative inline-flex items-center h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${settings.memoryEnabled ? 'bg-sky-500' : 'bg-slate-700'}`}>
                                 <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out ${settings.memoryEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                             </button>
                         </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatSettingsPopover;