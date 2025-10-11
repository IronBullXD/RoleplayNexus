import React, { useState, useEffect, useRef, useMemo } from 'react';
import { World, WorldEntry, WorldEntryCategory } from '../types';
import { Icon } from './Icon';
import Avatar from './Avatar';
import { useAppStore } from '../store/useAppStore';
import { Tooltip } from './Tooltip';

interface WorldEditorPageProps {
  world: Partial<World> | null;
  onSave: (world: World) => void;
  onClose: () => void;
}

const categoryIcons: Record<WorldEntryCategory, string> = {
  [WorldEntryCategory.CHARACTER]: 'character',
  [WorldEntryCategory.LOCATION]: 'map-pin',
  [WorldEntryCategory.ITEM]: 'cube',
  [WorldEntryCategory.FACTION]: 'shield',
  [WorldEntryCategory.LORE]: 'book-open',
  [WorldEntryCategory.EVENT]: 'calendar',
  [WorldEntryCategory.WORLD]: 'globe',
};

const categoryOptions = Object.values(WorldEntryCategory);

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
          className="appearance-none w-5 h-5 border-2 border-slate-600 rounded-md checked:bg-sky-500 checked:border-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-sky-500 transition-colors cursor-pointer"
        />
        {checked && !indeterminate && (
          <Icon name="checkmark" className="w-4 h-4 text-white absolute pointer-events-none" />
        )}
        {indeterminate && (
          <div className="w-2.5 h-1 bg-sky-500 rounded-sm absolute pointer-events-none" />
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

const EntryEditor: React.FC<{
  entry: WorldEntry;
  allEntries: WorldEntry[];
  onEntryChange: (id: string, field: keyof WorldEntry, value: any) => void;
}> = ({ entry, allEntries, onEntryChange }) => {
  const linkedEntries: WorldEntry[] = useMemo(() => {
    const linked = new Map<string, WorldEntry>();
    const currentContent = (entry.content || '').toLowerCase();
    if (!currentContent) return [];

    for (const otherEntry of allEntries) {
      if (
        otherEntry.id === entry.id ||
        !otherEntry.keys ||
        otherEntry.keys.length === 0
      )
        continue;
      for (const key of otherEntry.keys) {
        if (key.trim().length < 2) continue;
        try {
          const regex = new RegExp(
            `\\b${key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`,
            'gi',
          );
          if (currentContent.match(regex)) {
            linked.set(otherEntry.id, otherEntry);
            break;
          }
        } catch (e) {
          /* Ignore invalid regex from user input */
        }
      }
    }
    return Array.from(linked.values());
  }, [entry.id, entry.content, allEntries]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <label
          htmlFor={`entry-name-${entry.id}`}
          className="block text-sm font-medium text-slate-300 mb-1"
        >
          Entry Name
        </label>
        <input
          type="text"
          id={`entry-name-${entry.id}`}
          value={entry.name || ''}
          onChange={(e) => onEntryChange(entry.id, 'name', e.target.value)}
          className="block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm p-2 placeholder:text-slate-600"
          placeholder="e.g., The Silver Dragon Inn"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor={`entry-keys-${entry.id}`}
            className="block text-sm font-medium text-slate-300 mb-1"
          >
            Keywords
          </label>
          <input
            type="text"
            id={`entry-keys-${entry.id}`}
            value={(entry.keys || []).join(', ')}
            onChange={(e) =>
              onEntryChange(
                entry.id,
                'keys',
                e.target.value.split(',').map((k) => k.trim()),
              )
            }
            className="block w-full bg-slate-950 border-2 border-slate-700 rounded-lg p-2 text-sm"
            placeholder="inn, tavern, rest"
          />
        </div>
        <div>
          <label
            htmlFor={`entry-category-${entry.id}`}
            className="block text-sm font-medium text-slate-300 mb-1"
          >
            Category
          </label>
          <select
            id={`entry-category-${entry.id}`}
            value={entry.category || ''}
            onChange={(e) =>
              onEntryChange(entry.id, 'category', e.target.value || undefined)
            }
            className="block w-full bg-slate-950 border-2 border-slate-700 rounded-lg p-2 text-sm"
          >
            <option value="">(Uncategorized)</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Status
        </label>
        <div className="flex items-center gap-6 pt-2">
          <label
            htmlFor={`entry-enabled-${entry.id}`}
            className="flex items-center cursor-pointer group/toggle"
          >
            <div className="relative">
              <input
                type="checkbox"
                id={`entry-enabled-${entry.id}`}
                checked={entry.enabled}
                onChange={(e) =>
                  onEntryChange(entry.id, 'enabled', e.target.checked)
                }
                className="sr-only"
              />
              <div
                className={`block w-10 h-6 rounded-full transition-colors ${
                  entry.enabled ? 'bg-sky-500' : 'bg-slate-700'
                }`}
              ></div>
              <div
                className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                  entry.enabled ? 'translate-x-4' : ''
                }`}
              ></div>
            </div>
            <span className="text-sm font-medium text-slate-300 ml-3 group-hover/toggle:text-white transition-colors">
              Enabled
            </span>
          </label>
          <label
            htmlFor={`entry-always-active-${entry.id}`}
            className="flex items-center cursor-pointer group/toggle"
          >
            <div className="relative">
              <input
                type="checkbox"
                id={`entry-always-active-${entry.id}`}
                checked={!!entry.isAlwaysActive}
                onChange={(e) =>
                  onEntryChange(entry.id, 'isAlwaysActive', e.target.checked)
                }
                className="sr-only"
              />
              <div
                className={`block w-10 h-6 rounded-full transition-colors ${
                  entry.isAlwaysActive ? 'bg-fuchsia-500' : 'bg-slate-700'
                }`}
              ></div>
              <div
                className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                  entry.isAlwaysActive ? 'translate-x-4' : ''
                }`}
              ></div>
            </div>
            <span className="text-sm font-medium text-slate-300 ml-3 group-hover/toggle:text-white transition-colors">
              Always Active
            </span>
          </label>
        </div>
      </div>

      <div>
        <label
          htmlFor={`entry-content-${entry.id}`}
          className="block text-sm font-medium text-slate-300 mb-1"
        >
          Content
        </label>
        <textarea
          id={`entry-content-${entry.id}`}
          value={entry.content}
          onChange={(e) => onEntryChange(entry.id, 'content', e.target.value)}
          rows={8}
          className="block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm p-2 placeholder:text-slate-600 custom-scrollbar"
          placeholder="Details about this lore entry..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Linked Lore (Auto-detected)
        </label>
        <div className="p-2 bg-slate-950 border-2 border-slate-700 rounded-md min-h-[40px] flex flex-wrap gap-2 items-center">
          {linkedEntries.length > 0 ? (
            linkedEntries.map((linked) => (
              <div
                key={linked.id}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-sky-300 bg-sky-900/50 border border-sky-700/50 rounded-full"
              >
                <Icon
                  name={
                    categoryIcons[linked.category || WorldEntryCategory.LORE] ||
                    'book-open'
                  }
                  className="w-3 h-3"
                />
                <span>{linked.name || 'Unnamed'}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 italic px-1">
              No keywords from other entries found in this content.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const WorldEditorPage: React.FC<WorldEditorPageProps> = ({
  world,
  onSave,
  onClose,
}) => {
  const { requestConfirmation } = useAppStore();
  const [formData, setFormData] = useState<Partial<World>>({
    name: '',
    avatar: '',
    description: '',
    entries: [],
  });
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(
    new Set(),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (world) {
      let processedEntries = world.entries;
      const legacyContent = (world as any).content;
      if (typeof legacyContent === 'string' && !world.entries) {
        processedEntries = [
          {
            id: crypto.randomUUID(),
            name: world.name ? `${world.name} General` : 'General Lore',
            keys: world.name
              ? [world.name.toLowerCase(), 'general']
              : ['general'],
            content: legacyContent,
            enabled: true,
            isAlwaysActive: true,
            category: WorldEntryCategory.LORE,
          },
        ];
      }
      if (processedEntries) {
        processedEntries = processedEntries.map((e) => ({
          ...e,
          id: e.id || crypto.randomUUID(),
        }));
      }
      setFormData({ ...world, entries: processedEntries });
      if (processedEntries && processedEntries.length > 0)
        setActiveEntryId(processedEntries[0].id);
      else setActiveEntryId(null);
    }
  }, [world]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const reader = new FileReader();
      reader.onloadend = () =>
        setFormData((p) => ({ ...p, avatar: reader.result as string }));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleEntryChange = (id: string, field: keyof WorldEntry, value: any) => {
    setFormData((prev) => ({
      ...prev,
      entries: (prev.entries || []).map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry,
      ),
    }));
  };

  const handleAddNewEntry = () => {
    const newEntry: WorldEntry = {
      id: crypto.randomUUID(),
      name: 'New Entry',
      keys: [],
      content: '',
      enabled: true,
      isAlwaysActive: false,
    };
    setFormData((prev) => ({
      ...prev,
      entries: [...(prev.entries || []), newEntry],
    }));
    setActiveEntryId(newEntry.id);
  };

  const handleDeleteEntry = (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    const entry = formData.entries?.find((e) => e.id === entryId);
    if (!entry) return;
    requestConfirmation(
      () => {
        setFormData((prev) => {
          const newEntries = (prev.entries || []).filter((e) => e.id !== entryId);
          if (activeEntryId === entryId)
            setActiveEntryId(newEntries.length > 0 ? newEntries[0].id : null);
          return { ...prev, entries: newEntries };
        });
      },
      'Delete Entry',
      `Are you sure you want to delete "${
        entry.name || 'Unnamed Entry'
      }"?`,
      'Delete',
      'danger',
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalEntries = (formData.entries || []).map((entry) => ({
      ...entry,
      keys: (entry.keys || []).map((k) => k.trim()).filter(Boolean),
    }));
    onSave({
      id: formData.id || crypto.randomUUID(),
      name: formData.name || 'Unnamed World',
      description: formData.description || '',
      avatar: formData.avatar || '',
      entries: finalEntries,
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleToggleSelection = (id: string) => {
    setSelectedEntryIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedEntryIds.size === (formData.entries || []).length)
      setSelectedEntryIds(new Set());
    else setSelectedEntryIds(new Set((formData.entries || []).map((e) => e.id)));
  };

  const handleBatchUpdate = (update: Partial<WorldEntry>) => {
    setFormData((prev) => ({
      ...prev,
      entries: (prev.entries || []).map((e) =>
        selectedEntryIds.has(e.id) ? { ...e, ...update } : e,
      ),
    }));
  };

  const handleBatchDelete = () => {
    requestConfirmation(
      () => {
        setFormData((prev) => {
          const newEntries = (prev.entries || []).filter(
            (e) => !selectedEntryIds.has(e.id),
          );
          if (activeEntryId && selectedEntryIds.has(activeEntryId))
            setActiveEntryId(newEntries.length > 0 ? newEntries[0].id : null);
          return { ...prev, entries: newEntries };
        });
        setSelectedEntryIds(new Set());
      },
      'Delete Selected Entries',
      `Are you sure you want to delete these ${selectedEntryIds.size} entries?`,
      'Delete',
      'danger',
    );
  };

  const activeEntry = useMemo(
    () => formData.entries?.find((e) => e.id === activeEntryId),
    [formData.entries, activeEntryId],
  );
  const entriesByCategory = useMemo(() => {
    const UNCATEGORIZED = '(Uncategorized)';
    const grouped: Record<string, WorldEntry[]> = {};
    (formData.entries || []).forEach((entry) => {
      const category = entry.category || UNCATEGORIZED;
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(entry);
    });
    return Object.entries(grouped).sort((a, b) => {
      if (a[0] === UNCATEGORIZED) return -1;
      if (b[0] === UNCATEGORIZED) return 1;
      return (
        categoryOptions.indexOf(a[0] as WorldEntryCategory) -
        categoryOptions.indexOf(b[0] as WorldEntryCategory)
      );
    });
  }, [formData.entries]);

  const selectionMode = selectedEntryIds.size > 0;
  const isAllSelected =
    (formData.entries?.length || 0) > 0 &&
    selectedEntryIds.size === (formData.entries?.length || 0);
  const isIndeterminate = selectedEntryIds.size > 0 && !isAllSelected;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-slate-700 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold font-display tracking-widest uppercase">
            {world?.id ? 'Edit World' : 'Create World'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md"
          >
            <Icon name="close" />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="p-6 border-b border-slate-800 shrink-0">
            <div className="flex items-center space-x-6">
              <Avatar
                src={formData.avatar}
                alt={formData.name || 'World'}
                className="w-24 h-24"
                shape="square"
              />
              <div className="flex-1">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-slate-300"
                >
                  World Name
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="mt-1 block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-lg p-3 placeholder:text-slate-600"
                  required
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-sky-400 hover:underline mt-2"
                >
                  Upload Image
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*"
                />
              </div>
            </div>
            <div className="mt-4">
              <label
                htmlFor="description"
                className="block text-sm font-medium text-slate-300"
              >
                Description
              </label>
              <textarea
                name="description"
                id="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                className="mt-1 block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm p-3 placeholder:text-slate-600 custom-scrollbar"
                placeholder="A brief summary of this world."
              />
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <aside className="w-[35%] border-r border-slate-800 flex flex-col bg-slate-900/50">
              <div className="p-3 border-b border-slate-800 shrink-0 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleAddNewEntry}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-sky-300 bg-sky-900/50 border border-sky-700/70 rounded-lg hover:bg-sky-800/50 transition-colors"
                >
                  <Icon name="add" className="w-4 h-4" /> New Lore Entry
                </button>
                {selectionMode && (
                  <div className="p-2 bg-slate-800 rounded-md flex justify-between items-center animate-fade-in">
                    <div className="flex items-center gap-3">
                      <CustomCheckbox
                        id="select-all-action"
                        checked={isAllSelected}
                        indeterminate={isIndeterminate}
                        onChange={handleToggleSelectAll}
                      />
                      <span className="text-sm font-semibold text-slate-300">
                        {selectedEntryIds.size} selected
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Tooltip content="Enable Selected">
                        <button
                          type="button"
                          onClick={() => handleBatchUpdate({ enabled: true })}
                          className="p-2 text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-700 rounded-md"
                        >
                          <Icon name="checkmark" className="w-4 h-4" />
                        </button>
                      </Tooltip>
                      <Tooltip content="Disable Selected">
                        <button
                          type="button"
                          onClick={() => handleBatchUpdate({ enabled: false })}
                          className="p-2 text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-700 rounded-md"
                        >
                          <Icon name="minus-square" className="w-4 h-4" />
                        </button>
                      </Tooltip>
                      <Tooltip content="Delete Selected">
                        <button
                          type="button"
                          onClick={handleBatchDelete}
                          className="p-2 text-fuchsia-400 hover:text-fuchsia-300 bg-slate-700/60 hover:bg-slate-700 rounded-md"
                        >
                          <Icon name="delete" className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                <div className="space-y-2 mt-1">
                  {entriesByCategory.map(([category, entries]) => (
                    <div key={category}>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 py-1">
                        {category}
                      </h3>
                      <div className="space-y-1 mt-1">
                        {entries.map((entry) => (
                          <div
                            key={entry.id}
                            onClick={() =>
                              selectionMode
                                ? handleToggleSelection(entry.id)
                                : setActiveEntryId(entry.id)
                            }
                            className={`w-full flex items-center justify-between gap-2 text-left p-1 pr-2 rounded-md transition-colors group/item cursor-pointer ${
                              activeEntryId === entry.id
                                ? 'bg-sky-600/30'
                                : 'hover:bg-slate-800/60'
                            } ${
                              selectedEntryIds.has(entry.id)
                                ? 'bg-sky-900/50'
                                : ''
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div
                                className={`transition-opacity ${
                                  selectionMode
                                    ? 'opacity-100'
                                    : 'opacity-0 group-hover/item:opacity-100'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSelection(entry.id);
                                }}
                              >
                                <CustomCheckbox
                                  id={`select-entry-${entry.id}`}
                                  checked={selectedEntryIds.has(entry.id)}
                                  onChange={() => {}}
                                />
                              </div>
                              {entry.isAlwaysActive && (
                                <Tooltip content="Always Active">
                                  <Icon
                                    name="pin"
                                    className="w-4 h-4 text-fuchsia-400 shrink-0"
                                  />
                                </Tooltip>
                              )}
                              <span
                                className={`truncate text-sm font-medium ${
                                  !entry.enabled
                                    ? 'text-slate-500 line-through'
                                    : activeEntryId === entry.id
                                      ? 'text-sky-200'
                                      : 'text-slate-300'
                                }`}
                              >
                                {entry.name || 'Unnamed Entry'}
                              </span>
                            </div>
                            <div className="opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => handleDeleteEntry(e, entry.id)}
                                className="p-1 text-slate-500 hover:text-fuchsia-400 hover:bg-slate-700 rounded-md"
                              >
                                <Icon name="delete" className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {formData.entries?.length === 0 && (
                    <div className="text-center text-slate-500 p-8">
                      <p>This world has no lore yet.</p>
                      <p className="text-xs mt-1">
                        Click "New Lore Entry" to begin.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </aside>

            <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {activeEntry ? (
                <EntryEditor
                  entry={activeEntry}
                  allEntries={formData.entries || []}
                  onEntryChange={handleEntryChange}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center">
                  <Icon name="book-open" className="w-16 h-16" />
                  <p className="mt-4 font-semibold text-slate-400">
                    No entry selected
                  </p>
                  <p className="text-sm">
                    Select an entry from the list or create a new one.
                  </p>
                </div>
              )}
            </main>
          </div>

          <footer className="p-4 border-t border-slate-800 flex justify-end space-x-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 border border-slate-600 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors border border-sky-400/50 shadow-md shadow-sky-900/50"
            >
              Save World
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default WorldEditorPage;
