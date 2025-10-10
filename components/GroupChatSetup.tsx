import React, { useState } from 'react';
import { Character } from '../types';
import { Icon } from './Icon';
import Avatar from './Avatar';
import { useAppStore } from '../store/useAppStore';

interface GroupChatSetupProps {
    onBack: () => void;
}

const GroupChatSetup: React.FC<GroupChatSetupProps> = ({ onBack }) => {
    const { characters, createGroupChat } = useAppStore();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [scenario, setScenario] = useState('');

    const handleToggleCharacter = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleSubmit = () => {
        if (selectedIds.size >= 2 && scenario.trim()) {
            createGroupChat(Array.from(selectedIds), scenario.trim());
        }
    };
    
    const isValid = selectedIds.size >= 2 && scenario.trim().length > 0;

    return (
        <div className="w-full h-screen bg-slate-950 flex flex-col">
            <header className="p-4 flex items-center gap-4 border-b border-slate-800 shrink-0 bg-slate-950/70 backdrop-blur-sm sticky top-0 z-10">
                <button onClick={onBack} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md"><Icon name="arrow-left" /></button>
                <h1 className="text-2xl font-bold font-display tracking-widest uppercase">Create Group Chat</h1>
            </header>

            <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 max-w-4xl mx-auto w-full custom-scrollbar">
                <div>
                    <h2 className="text-lg font-semibold text-slate-200 font-display tracking-wider">1. SELECT CHARACTERS (2+)</h2>
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {characters.map(char => (
                            <button key={char.id} onClick={() => handleToggleCharacter(char.id)} className={`relative rounded-lg overflow-hidden aspect-square focus:outline-none transition-all duration-200 group ${selectedIds.has(char.id) ? 'ring-4 ring-sky-500 scale-95' : 'ring-2 ring-transparent hover:ring-slate-600'}`}>
                                <Avatar src={char.avatar} alt={char.name} className="w-full h-full" />
                                <div className={`absolute inset-0 bg-gradient-to-t from-black/80 to-transparent transition-opacity ${selectedIds.has(char.id) ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}></div>
                                <p className="absolute bottom-2 left-2 right-2 text-sm font-bold text-white truncate">{char.name}</p>
                                {selectedIds.has(char.id) && (
                                    <div className="absolute top-2 right-2 w-6 h-6 bg-sky-500 rounded-full flex items-center justify-center border-2 border-slate-950"><Icon name="checkmark" className="w-4 h-4 text-white" /></div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <h2 className="text-lg font-semibold text-slate-200 font-display tracking-wider">2. DEFINE THE SCENARIO</h2>
                    <p className="text-sm text-slate-400 mt-1">Describe the setting or initial situation for the characters.</p>
                    <textarea value={scenario} onChange={e => setScenario(e.target.value)} rows={5} className="mt-4 block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm p-3 placeholder:text-slate-600 custom-scrollbar" placeholder="e.g., You are all gathered in a dimly lit tavern, seeking shelter from a raging storm..." />
                </div>
            </main>
            
            <footer className="p-4 border-t border-slate-800 shrink-0 flex justify-end bg-slate-950/70 backdrop-blur-sm sticky bottom-0 z-10">
                <button onClick={handleSubmit} disabled={!isValid} className="px-6 py-2.5 text-base font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors border border-sky-400/50 shadow-md shadow-sky-900/50">Start Chat</button>
            </footer>
        </div>
    );
};

export default GroupChatSetup;