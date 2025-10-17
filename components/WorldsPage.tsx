import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { World, WorldTemplate } from '../types';
import { Icon } from './Icon';
import Avatar from './Avatar';
import WorldEditorPage from './WorldEditorPage';
import { useWorldStore } from '../store/stores/worldStore';
import { motion, AnimatePresence } from 'framer-motion';
import { warmWorldCache } from '../services/llmService';
import { logger } from '../services/logger';
import { DEFAULT_WORLD_TEMPLATES, WORLD_CATEGORIES } from '../constants';

const CustomCheckbox: React.FC<{
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement> | React.MouseEvent) => void;
  indeterminate?: boolean;
  id: string;
  label?: string;
}> = ({ checked, onChange, indeterminate = false, id, label }) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-5 h-5 flex items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
          className="appearance-none w-5 h-5 border-2 border-slate-600 rounded-md checked:bg-crimson-500 checked:border-crimson-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-crimson-500 transition-colors cursor-pointer"
        />
        {checked && !indeterminate && (
          <Icon
            name="checkmark"
            className="w-4 h-4 text-white absolute pointer-events-none"
          />
        )}
        {indeterminate && (
          <div className="w-2.5 h-1 bg-crimson-500 rounded-sm absolute pointer-events-none" />
        )}
      </div>
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-slate-300 cursor-pointer"
        >
          {label}
        </label>
      )}
    </div>
  );
};

interface WorldsPageProps {
  worlds: World[];
  onClose: () => void;
}

const WorldItem: React.FC<{
  world: World;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
}> = ({ world, onEdit, onDelete, onExport, isSelected, onToggleSelect }) => (
  <div
    onClick={onToggleSelect}
    className={`w-full flex items-center gap-2 p-2 pr-4 bg-slate-900/50 border hover:bg-slate-800/50 rounded-lg transition-all group cursor-pointer ${
      isSelected
        ? 'border-crimson-500/80 bg-slate-800/50'
        : 'border-slate-800 hover:border-crimson-500/50'
    }`}
  >
    <div className="flex items-center pl-2" onClick={(e) => e.stopPropagation()}>
      <CustomCheckbox
        id={`select-world-${world.id}`}
        checked={isSelected}
        onChange={onToggleSelect}
      />
    </div>
    <div className="flex-1 flex items-start gap-4 overflow-hidden text-left p-2">
      <Avatar
        src={world.avatar}
        alt={world.name}
        shape="square"
        className="w-12 h-12"
      />
      <div className="flex-1 overflow-hidden">
        <h2 className="font-bold text-slate-100 truncate">{world.name}</h2>
        <p className="text-sm text-slate-400 truncate mt-1">
          {world.description || 'No description.'}
        </p>
        {world.tags && world.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-2">
            {world.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs font-semibold bg-ember-600/80 text-white px-1.5 py-0.5 rounded-full shadow">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
    <div
      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onEdit}
        className="p-2 text-slate-400 hover:text-crimson-400 hover:bg-slate-700/50 rounded-md"
        aria-label={`Edit world: ${world.name}`}
      >
        <Icon name="edit" className="w-5 h-5" />
      </button>
      <button
        onClick={onExport}
        className="p-2 text-slate-400 hover:text-crimson-400 hover:bg-slate-700/50 rounded-md"
        aria-label={`Export world: ${world.name}`}
      >
        <Icon name="export" className="w-5 h-5" />
      </button>
      <button
        onClick={onDelete}
        className="p-2 text-slate-400 hover:text-ember-500 hover:bg-slate-700/50 rounded-md"
        aria-label={`Delete world: ${world.name}`}
      >
        <Icon name="delete" className="w-5 h-5" />
      </button>
    </div>
  </div>
);

const TemplateSelectionModal: React.FC<{
  onSelect: (template: Partial<World> | null) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/80 z-[60] flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-selection-title"
        className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl border border-slate-700"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h2 id="template-selection-title" className="text-xl font-bold font-display tracking-widest uppercase">Create a New World</h2>
          <button onClick={onClose} aria-label="Close template selection" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md"><Icon name="close" /></button>
        </header>
        <main className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={() => onSelect(null)}
              className="bg-slate-800/50 rounded-lg p-4 flex flex-col items-center justify-center text-center h-48 border-2 border-dashed border-slate-700 hover:border-crimson-500 hover:bg-slate-800 transition-colors"
            >
              <Icon name="add" className="w-10 h-10 text-slate-600" />
              <p className="mt-2 font-semibold text-slate-400">Start with a Blank World</p>
            </button>
            {DEFAULT_WORLD_TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className="bg-slate-800/50 rounded-lg p-4 flex flex-col text-left h-48 border-2 border-slate-700 hover:border-crimson-500 hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                    <Avatar src={template.avatar} alt={template.name} shape="square" className="w-10 h-10" />
                    <h3 className="font-bold text-slate-100 flex-1">{template.name}</h3>
                </div>
                <p className="text-sm text-slate-400 mt-2 flex-1">{template.description}</p>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold bg-crimson-900/50 text-crimson-300 px-2 py-0.5 rounded-full">{template.category}</span>
                </div>
              </button>
            ))}
          </div>
        </main>
      </motion.div>
    </motion.div>
  );
};


const WorldsPage: React.FC<WorldsPageProps> = ({ onClose }) => {
  const { worlds, saveWorld, deleteWorld, importWorlds } = useWorldStore();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingWorld, setEditingWorld] = useState<Partial<World> | null>(null);
  const [selectedWorldIds, setSelectedWorldIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('lastModified-desc');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditorOpen && !isTemplateModalOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isEditorOpen, isTemplateModalOpen]);

  useEffect(() => {
    if (worlds.length > 0) {
      const timer = setTimeout(() => {
        logger.log('Preloading all world indices from Worlds page.');
        warmWorldCache(worlds);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [worlds]);

  const handleCreateFromTemplate = useCallback((template: Partial<World> | null) => {
    const newWorld: Partial<World> = template ? { ...template, id: crypto.randomUUID() } : { name: 'New World', entries: [] };
    setEditingWorld(newWorld);
    setIsEditorOpen(true);
    setTemplateModalOpen(false);
  }, []);

  const handleEdit = (world: World) => {
    setEditingWorld(world);
    setIsEditorOpen(true);
  };
  const handleSave = (world: World) => {
    saveWorld(world);
    setIsEditorOpen(false);
    setEditingWorld(null);
  };

  const handleToggleWorldSelection = (worldId: string) => {
    setSelectedWorldIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(worldId)) newSet.delete(worldId);
      else newSet.add(worldId);
      return newSet;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedWorldIds.size === filteredAndSortedWorlds.length) {
      setSelectedWorldIds(new Set());
    } else {
      setSelectedWorldIds(new Set(filteredAndSortedWorlds.map((w) => w.id)));
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          if (Array.isArray(imported) && imported.every((item) => item && 'id' in item && 'name' in item && 'entries' in item)) {
            importWorlds(imported);
          } else {
            alert('Invalid world file format. Expected an array of world objects.');
          }
        } catch (error) {
          alert('Failed to parse world file. Ensure it is valid JSON.');
        }
      };
      reader.readAsText(file);
      if (event.target) event.target.value = '';
    }
  };

  const handleExportWorld = (world: World) => {
    try {
      const filename = `${world.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
      const blob = new Blob([JSON.stringify([world], null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Error exporting world: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExportSelectedWorlds = () => {
    if (selectedWorldIds.size === 0) {
      alert('No worlds selected to export.');
      return;
    }
    const worldsToExport = worlds.filter((w) => selectedWorldIds.has(w.id));
    try {
      const filename = worldsToExport.length === 1 ? `${worldsToExport[0].name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json` : `roleplay_nexus_worlds_selected.json`;
      const blob = new Blob([JSON.stringify(worldsToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Error exporting selected worlds: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };
  
  const worldCategories = useMemo(() => ['All', ...new Set(worlds.map(w => w.category).filter(Boolean) as string[])], [worlds]);

  const filteredAndSortedWorlds = useMemo(() => {
    return worlds
      .filter(world => {
        const categoryMatch = categoryFilter === 'All' || world.category === categoryFilter;
        const searchMatch = searchQuery === '' || world.name.toLowerCase().includes(searchQuery.toLowerCase()) || (world.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        return categoryMatch && searchMatch;
      })
      .sort((a, b) => {
        switch(sortOrder) {
          case 'name-asc': return a.name.localeCompare(b.name);
          case 'name-desc': return b.name.localeCompare(a.name);
          case 'createdAt-desc': return (b.createdAt || 0) - (a.createdAt || 0);
          case 'createdAt-asc': return (a.createdAt || 0) - (b.createdAt || 0);
          case 'lastModified-desc':
          default:
            return (b.lastModified || 0) - (a.lastModified || 0);
        }
      });
  }, [worlds, categoryFilter, sortOrder, searchQuery]);

  const allSelected = filteredAndSortedWorlds.length > 0 && selectedWorldIds.size === filteredAndSortedWorlds.length;
  const isIndeterminate = selectedWorldIds.size > 0 && !allSelected;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="worlds-page-title"
          className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl flex flex-col border border-slate-700 h-[80vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
            <h2 id="worlds-page-title" className="text-xl font-bold font-display tracking-widest uppercase">Worlds</h2>
            <div className="flex items-center gap-2">
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search worlds..." className="bg-slate-800/60 border-2 border-slate-700 rounded-lg py-1.5 px-3 text-sm" />
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-slate-800/60 border-2 border-slate-700 rounded-lg py-1.5 px-3 text-sm">
                    {worldCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="bg-slate-800/60 border-2 border-slate-700 rounded-lg py-1.5 px-3 text-sm">
                    <option value="lastModified-desc">Sort: Last Modified</option>
                    <option value="name-asc">Sort: Name (A-Z)</option>
                    <option value="name-desc">Sort: Name (Z-A)</option>
                    <option value="createdAt-desc">Sort: Newest</option>
                    <option value="createdAt-asc">Sort: Oldest</option>
                </select>
                <button onClick={onClose} aria-label="Close worlds page" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md ml-4"><Icon name="close" /></button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
            {worlds.length > 0 && (
              <div className="flex items-center justify-between p-2 mb-2 border-b border-slate-800">
                <div className="flex items-center">
                  <CustomCheckbox id="select-all-worlds" checked={allSelected} indeterminate={isIndeterminate} onChange={handleToggleSelectAll} label="Select All" />
                </div>
                {selectedWorldIds.size > 0 && (<span className="text-sm text-slate-400 font-medium">{selectedWorldIds.size} of {filteredAndSortedWorlds.length} selected</span>)}
              </div>
            )}
            <div className="space-y-3">
              {filteredAndSortedWorlds.length > 0 ? (
                filteredAndSortedWorlds.map((world) => (
                  <WorldItem key={world.id} world={world} onEdit={() => handleEdit(world)} onDelete={() => deleteWorld(world.id)} onExport={() => handleExportWorld(world)} isSelected={selectedWorldIds.has(world.id)} onToggleSelect={() => handleToggleWorldSelection(world.id)} />
                ))
              ) : (
                <div className="text-center text-slate-500 pt-16 flex flex-col items-center">
                  <Icon name="book-open" className="w-16 h-16 text-slate-700" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-300">
                    {searchQuery || categoryFilter !== 'All' ? 'No Worlds Match Your Filters' : 'No Worlds Found'}
                  </h3>
                  <p className="mt-1 max-w-sm">
                    {searchQuery || categoryFilter !== 'All' ? 'Try adjusting your search or filter options.' : 'Worlds provide context and lore for your chats. Create one to get started.'}
                  </p>
                </div>
              )}
            </div>
          </main>
          <footer className="p-4 border-t border-slate-800 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept=".json" />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 hover:bg-slate-700 rounded-md transition-colors border border-slate-600"><Icon name="import" className="w-4 h-4" /> Import</button>
              <button onClick={handleExportSelectedWorlds} disabled={selectedWorldIds.size === 0} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 hover:bg-slate-700 rounded-md transition-colors border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"><Icon name="export" className="w-4 h-4" /> {selectedWorldIds.size > 0 ? `Export Selected (${selectedWorldIds.size})` : 'Export Selected'}</button>
            </div>
            <button onClick={() => setTemplateModalOpen(true)} className="px-4 py-2 text-sm font-semibold text-white bg-crimson-600 hover:bg-crimson-500 rounded-lg transition-colors border border-crimson-400/50 shadow-md shadow-crimson-900/50">Create New World</button>
          </footer>
        </motion.div>
      </motion.div>
      <AnimatePresence>
        {isEditorOpen && (<WorldEditorPage world={editingWorld} onSave={handleSave} onClose={() => setIsEditorOpen(false)} />)}
        {isTemplateModalOpen && (<TemplateSelectionModal onSelect={handleCreateFromTemplate} onClose={() => setTemplateModalOpen(false)} />)}
      </AnimatePresence>
    </>
  );
};

export default WorldsPage;