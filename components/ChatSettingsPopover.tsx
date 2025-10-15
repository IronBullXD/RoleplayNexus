import React, { useState, useRef, useEffect } from 'react';
import { World, Settings } from '../types';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';

interface ChatSettingsPopoverProps {
    settings: Pick<Settings, 'worldId' | 'temperature' | 'contextSize' | 'maxOutputTokens'> & { memoryEnabled: boolean };
    worlds: World[];
    onSetWorld: (worldId: string | null) => void;
    onSetTemperature: (temperature: number) => void;
    onSetContextSize: (size: number) => void;
    onSetMaxOutputTokens: (tokens: number) => void;
    onSetMemoryEnabled: (enabled: boolean) => void;
}

const ChatSettingsPopover: React.FC<ChatSettingsPopoverProps> = ({ settings, worlds, onSetWorld, onSetTemperature, onSetContextSize, onSetMaxOutputTokens, onSetMemoryEnabled }) => {
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
                    className="p-2 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 text-slate-300 bg-slate-800/50 hover:bg-slate-700/50"
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
                            className="block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-crimson-500 focus:border-crimson-500 sm:text-sm p-2"
                        >
                            <option value="">(No World)</option>
                            {worlds.map(world => (
                                <option key={world.id} value={world.id}>{world.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Temperature */}
                    <div>
                        <label htmlFor="temperature" className="block text-sm font-medium text-slate-300">Temperature</label>
                        <p className="text-xs text-slate-500 mb-2">Controls randomness. Lower is more predictable.</p>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                id="temperature"
                                min="0.1"
                                max="1.5"
                                step="0.05"
                                value={settings.temperature}
                                onChange={(e) => onSetTemperature(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer range-thumb"
                            />
                            <span className="text-sm font-mono text-slate-400 w-12 text-center">{settings.temperature.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    {/* Context Size */}
                    <div>
                        <label htmlFor="contextSize" className="block text-sm font-medium text-slate-300">Context Size (Tokens)</label>
                         <p className="text-xs text-slate-500 mb-2">How much history the AI remembers.</p>
                        <input
                            type="number"
                            id="contextSize"
                            step="1024"
                            value={settings.contextSize}
                            onChange={(e) => onSetContextSize(parseInt(e.target.value, 10) || 0)}
                            className="block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-crimson-500 focus:border-crimson-500 sm:text-sm p-2"
                        />
                    </div>

                    {/* Max Output Tokens */}
                    <div>
                        <label htmlFor="maxOutputTokens" className="block text-sm font-medium text-slate-300">Max Output Tokens</label>
                         <p className="text-xs text-slate-500 mb-2">Max length of a single AI response.</p>
                        <input
                            type="number"
                            id="maxOutputTokens"
                            step="256"
                            value={settings.maxOutputTokens}
                            onChange={(e) => onSetMaxOutputTokens(parseInt(e.target.value, 10) || 0)}
                            className="block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-crimson-500 focus:border-crimson-500 sm:text-sm p-2"
                        />
                    </div>
                    
                    {/* Memory */}
                    <div>
                        <label htmlFor="memoryEnabled" className="flex items-center justify-between cursor-pointer group/toggle p-2 rounded-md hover:bg-slate-800/50">
                            <div>
                                <span className="text-sm font-medium text-slate-300 group-hover/toggle:text-white transition-colors">Auto-Summarization</span>
                                <p className="text-xs text-slate-500">Summarize old messages to save context.</p>
                            </div>
                            <div className="relative">
                                <input
                                type="checkbox"
                                id="memoryEnabled"
                                checked={settings.memoryEnabled}
                                onChange={(e) => onSetMemoryEnabled(e.target.checked)}
                                className="sr-only"
                                />
                                <div className={`block w-10 h-6 rounded-full transition-colors ${settings.memoryEnabled ? 'bg-crimson-500' : 'bg-slate-700'}`}></div>
                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.memoryEnabled ? 'translate-x-4' : ''}`}></div>
                            </div>
                        </label>
                    </div>

                </div>
            )}
        </div>
    );
};

export default ChatSettingsPopover;
