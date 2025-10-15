import React, { useState, useEffect, useRef } from 'react';
import { World } from '../types';
import { Icon } from './Icon';
import Avatar from './Avatar';
import WorldEditorPage from './WorldEditorPage';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';

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

const WorldsPage: React.FC<WorldsPageProps> = ({ onClose }) => {
  const { worlds, saveWorld, deleteWorld, importWorlds } = useAppStore();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingWorld, setEditingWorld] = useState<Partial<World> | null>(null);
  const [selectedWorldIds, setSelectedWorldIds] = useState<Set<string>>(
    new Set(),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditorOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isEditorOpen]);

  const handleCreateNew = () => {
    setEditingWorld(null);
    setIsEditorOpen(true);
  };
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
      if (newSet.has(worldId)) {
        newSet.delete(worldId);
      } else {
        newSet.add(worldId);
      }
      return newSet;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedWorldIds.size === worlds.length) {
      setSelectedWorldIds(new Set());
    } else {
      setSelectedWorldIds(new Set(worlds.map((w) => w.id)));
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          if (
            Array.isArray(imported) &&
            imported.every(
              (item) =>
                item &&
                'id' in item &&
                'name' in item &&
                'entries' in item,
            )
          ) {
            importWorlds(imported);
          } else {
            alert(
              'Invalid world file format. Expected an array of world objects.',
            );
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
      const filename = `${world.name
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase()}.json`;
      const blob = new Blob([JSON.stringify([world], null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(
        `Error exporting world: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      );
    }
  };

  const handleExportSelectedWorlds = () => {
    if (selectedWorldIds.size === 0) {
      alert('No worlds selected to export.');
      return;
    }
    const worldsToExport = worlds.filter((w) => selectedWorldIds.has(w.id));
    try {
      const filename =
        worldsToExport.length === 1
          ? `${worldsToExport[0].name
              .replace(/[^a-z0-9]/gi, '_')
              .toLowerCase()}.json`
          : `roleplay_nexus_worlds_selected.json`;
      const blob = new Blob([JSON.stringify(worldsToExport, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(
        `Error exporting selected worlds: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      );
    }
  };

  const allSelected =
    worlds.length > 0 && selectedWorldIds.size === worlds.length;
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
          className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl flex flex-col border border-slate-700 h-[80vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
            <h2 className="text-xl font-bold font-display tracking-widest uppercase">
              Worlds
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md"
            >
              <Icon name="close" />
            </button>
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
            {worlds.length > 0 && (
              <div className="flex items-center justify-between p-2 mb-2 border-b border-slate-800">
                <div className="flex items-center">
                  <CustomCheckbox
                    id="select-all-worlds"
                    checked={allSelected}
                    indeterminate={isIndeterminate}
                    onChange={handleToggleSelectAll}
                    label="Select All"
                  />
                </div>
                {selectedWorldIds.size > 0 && (
                  <span className="text-sm text-slate-400 font-medium">
                    {selectedWorldIds.size} of {worlds.length} selected
                  </span>
                )}
              </div>
            )}
            <div className="space-y-3">
              {worlds.length > 0 ? (
                worlds.map((world) => (
                  <WorldItem
                    key={world.id}
                    world={world}
                    onEdit={() => handleEdit(world)}
                    onDelete={() => deleteWorld(world.id)}
                    onExport={() => handleExportWorld(world)}
                    isSelected={selectedWorldIds.has(world.id)}
                    onToggleSelect={() => handleToggleWorldSelection(world.id)}
                  />
                ))
              ) : (
                <div className="text-center text-slate-500 pt-16 flex flex-col items-center">
                  <Icon name="book-open" className="w-16 h-16 text-slate-700" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-300">
                    No Worlds Found
                  </h3>
                  <p className="mt-1 max-w-sm">
                    Worlds provide context and lore for your chats. Create one
                    to get started.
                  </p>
                </div>
              )}
            </div>
          </main>
          <footer className="p-4 border-t border-slate-800 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                className="hidden"
                accept=".json"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 hover:bg-slate-700 rounded-md transition-colors border border-slate-600"
              >
                <Icon name="import" className="w-4 h-4" /> Import
              </button>
              <button
                onClick={handleExportSelectedWorlds}
                disabled={selectedWorldIds.size === 0}
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 hover:bg-slate-700 rounded-md transition-colors border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="export" className="w-4 h-4" />
                {selectedWorldIds.size > 0
                  ? `Export Selected (${selectedWorldIds.size})`
                  : 'Export Selected'}
              </button>
            </div>
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 text-sm font-semibold text-white bg-crimson-600 hover:bg-crimson-500 rounded-lg transition-colors border border-crimson-400/50 shadow-md shadow-crimson-900/50"
            >
              Create New World
            </button>
          </footer>
        </motion.div>
      </motion.div>
      <AnimatePresence>
        {isEditorOpen && (
          <WorldEditorPage
            world={editingWorld}
            onSave={handleSave}
            onClose={() => setIsEditorOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default WorldsPage;