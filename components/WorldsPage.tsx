import React, { useState, useEffect } from 'react';
import { World } from '../types';
import { Icon } from './Icon';
import Avatar from './Avatar';
import WorldEditorPage from './WorldEditorPage';
import { useAppContext } from '../contexts/AppContext';

interface WorldsPageProps {
  worlds: World[];
  onClose: () => void;
}

const WorldItem: React.FC<{ world: World; onEdit: () => void; onDelete: () => void; }> = ({ world, onEdit, onDelete }) => (
    <div className="w-full flex items-center gap-2 p-2 pr-4 bg-slate-900/50 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-800/50 rounded-lg transition-all group">
        <div className="flex-1 flex items-start gap-4 overflow-hidden text-left p-2">
            <Avatar src={world.avatar} alt={world.name} shape="square" className="w-12 h-12" />
            <div className="flex-1 overflow-hidden">
                <h2 className="font-bold text-slate-100 truncate">{world.name}</h2>
                <p className="text-sm text-slate-400 truncate mt-1">{world.description || 'No description.'}</p>
            </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={onEdit} className="p-2 text-slate-400 hover:text-sky-400 hover:bg-slate-700/50 rounded-md" aria-label={`Edit world: ${world.name}`}><Icon name="edit" className="w-5 h-5" /></button>
            <button onClick={onDelete} className="p-2 text-slate-400 hover:text-fuchsia-500 hover:bg-slate-700/50 rounded-md" aria-label={`Delete world: ${world.name}`}><Icon name="delete" className="w-5 h-5" /></button>
        </div>
    </div>
);

const WorldsPage: React.FC<WorldsPageProps> = ({ onClose }) => {
    const { worlds, saveWorld, deleteWorld } = useAppContext();
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingWorld, setEditingWorld] = useState<Partial<World> | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isEditorOpen) onClose(); };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, isEditorOpen]);

    const handleCreateNew = () => { setEditingWorld(null); setIsEditorOpen(true); };
    const handleEdit = (world: World) => { setEditingWorld(world); setIsEditorOpen(true); };
    const handleSave = (world: World) => { saveWorld(world); setIsEditorOpen(false); setEditingWorld(null); };

    return (
        <>
            <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
                <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl flex flex-col border border-slate-700 h-[80vh] animate-slide-up" onClick={e => e.stopPropagation()}>
                    <header className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
                        <h2 className="text-xl font-bold font-display tracking-widest uppercase">Worlds</h2>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md"><Icon name="close" /></button>
                    </header>
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                        <div className="space-y-3">
                            {worlds.length > 0 ? worlds.map(world => (
                                <WorldItem key={world.id} world={world} onEdit={() => handleEdit(world)} onDelete={() => deleteWorld(world.id)} />
                            )) : (
                                <div className="text-center text-slate-500 pt-16 flex flex-col items-center">
                                    <Icon name="book-open" className="w-16 h-16 text-slate-700" />
                                    <h3 className="mt-4 text-lg font-semibold text-slate-300">No Worlds Found</h3>
                                    <p className="mt-1 max-w-sm">Worlds provide context and lore for your chats. Create one to get started.</p>
                                </div>
                            )}
                        </div>
                    </main>
                    <footer className="p-4 border-t border-slate-800 flex justify-end shrink-0">
                        <button onClick={handleCreateNew} className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors border border-sky-400/50 shadow-md shadow-sky-900/50">Create New World</button>
                    </footer>
                </div>
            </div>
            {isEditorOpen && (
                <WorldEditorPage world={editingWorld} onSave={handleSave} onClose={() => setIsEditorOpen(false)} />
            )}
        </>
    );
};

export default WorldsPage;
