import React, { useState, useEffect, useRef, useMemo } from 'react';
import { World, WorldEntry, WorldEntryCategory } from '../types';
import { Icon } from './Icon';
import Avatar from './Avatar';
import { useAppStore } from '../store/useAppStore';
import { Tooltip } from './Tooltip';
import { motion } from 'framer-motion';

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

interface EntryEditorProps {
  entry: WorldEntry;
  allEntries: WorldEntry[];
  onEntryChange: <K extends keyof WorldEntry>(
    id: string,
    field: K,
    value: WorldEntry[K],
  ) => void;
}

const EntryInspectorPanel: React.FC<EntryEditorProps> = ({
  entry,
  allEntries,
  onEntryChange,
}) => {
  const keyInputRef = useRef<HTMLInputElement>(null);

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
          const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          // Use lookarounds for more robust whole-word matching, especially for keys with punctuation.
          const regex = new RegExp(`(?<!\\w)${escapedKey}(?!\\w)`, 'gi');
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

  const duplicateKeywords = useMemo(() => {
    const duplicates: { keyword: string; entries: string[] }[] = [];
    if (!entry.keys || entry.keys.length === 0) return duplicates;

    const keywordMap = new Map<string, string[]>();
    for (const otherEntry of allEntries) {
      if (otherEntry.id === entry.id) continue;
      for (const key of otherEntry.keys || []) {
        if (typeof key === 'string') {
          const lowerKey = key.toLowerCase().trim();
          if (lowerKey) {
            if (!keywordMap.has(lowerKey)) keywordMap.set(lowerKey, []);
            keywordMap.get(lowerKey)!.push(otherEntry.name || 'Unnamed');
          }
        }
      }
    }

    for (const key of new Set(entry.keys)) {
      if (typeof key === 'string') {
        const lowerKey = key.toLowerCase().trim();
        if (lowerKey && keywordMap.has(lowerKey)) {
          duplicates.push({
            keyword: key,
            entries: [...new Set(keywordMap.get(lowerKey)!)],
          });
        }
      }
    }
    return duplicates;
  }, [entry.id, entry.keys, allEntries]);

  const processAndAddKeywords = () => {
    const inputElement = keyInputRef.current;
    if (!inputElement || !inputElement.value.trim()) {
      return;
    }
    const inputValue = inputElement.value;
    const currentKeys = entry.keys || [];
    const lowercasedCurrentKeys = currentKeys.map((k) =>
      typeof k === 'string' ? k.toLowerCase() : '',
    );

    const newKeys = inputValue
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
      .filter((k) => !lowercasedCurrentKeys.includes(k.toLowerCase()));

    if (newKeys.length > 0) {
      onEntryChange(entry.id, 'keys', [
        ...currentKeys,
        ...[...new Set(newKeys)],
      ]);
    }
    inputElement.value = '';
  };

  const handleRemoveKeyword = (keyToRemove: string) => {
    onEntryChange(
      entry.id,
      'keys',
      (entry.keys || []).filter((k) => k !== keyToRemove),
    );
  };

  const handleKeyInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      processAndAddKeywords();
    }
    if (
      e.key === 'Backspace' &&
      keyInputRef.current?.value === '' &&
      (entry.keys || []).length > 0
    ) {
      const lastKey = entry.keys![entry.keys!.length - 1];
      handleRemoveKeyword(lastKey);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const currentKeys = entry.keys || [];
    const lowercasedCurrentKeys = currentKeys.map((k) =>
      typeof k === 'string' ? k.toLowerCase() : '',
    );

    const pastedKeys = pastedText
      .split(/,|\n/)
      .map((key) => key.trim())
      .filter(Boolean)
      .filter((k) => !lowercasedCurrentKeys.includes(k.toLowerCase()));

    if (pastedKeys.length > 0) {
      onEntryChange(entry.id, 'keys', [
        ...currentKeys,
        ...[...new Set(pastedKeys)],
      ]);
    }
    if (keyInputRef.current) {
      keyInputRef.current.value = '';
    }
  };

  const InspectorSection: React.FC<{
    title: string;
    icon: string;
    children: React.ReactNode;
  }> = ({ title, icon, children }) => (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-400 uppercase tracking-wider">
        <Icon name={icon} className="w-4 h-4" /> {title}
      </h4>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      <InspectorSection title="Status" icon="settings">
        <label
          htmlFor={`entry-enabled-${entry.id}`}
          className="flex items-center justify-between cursor-pointer group/toggle p-2 bg-slate-800/50 rounded-md"
        >
          <span className="text-sm font-medium text-slate-300 group-hover/toggle:text-white transition-colors">
            Enabled
          </span>
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
                entry.enabled ? 'bg-crimson-500' : 'bg-slate-700'
              }`}
            ></div>
            <div
              className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                entry.enabled ? 'translate-x-4' : ''
              }`}
            ></div>
          </div>
        </label>
        <label
          htmlFor={`entry-always-active-${entry.id}`}
          className="flex items-center justify-between cursor-pointer group/toggle p-2 bg-slate-800/50 rounded-md"
        >
          <span className="text-sm font-medium text-slate-300 group-hover/toggle:text-white transition-colors">
            Always Active
          </span>
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
                entry.isAlwaysActive ? 'bg-ember-500' : 'bg-slate-700'
              }`}
            ></div>
            <div
              className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                entry.isAlwaysActive ? 'translate-x-4' : ''
              }`}
            ></div>
          </div>
        </label>
      </InspectorSection>

      <InspectorSection title="Categorization" icon="edit">
        <select
          id={`entry-category-${entry.id}`}
          value={entry.category || ''}
          onChange={(e) =>
            onEntryChange(
              entry.id,
              'category',
              e.target.value as WorldEntryCategory,
            )
          }
          className="block w-full bg-slate-800 border-2 border-slate-700 rounded-lg p-2 text-sm focus:ring-crimson-500 focus:border-crimson-500"
        >
          <option value="">(No Category)</option>
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </InspectorSection>

      <InspectorSection title="Keywords" icon="send">
        <div
          onClick={() => keyInputRef.current?.focus()}
          className="flex flex-wrap items-center gap-2 p-2 bg-slate-800/50 border-2 border-slate-700 rounded-lg focus-within:ring-2 focus-within:ring-crimson-500 focus-within:border-crimson-500 cursor-text"
        >
          {(entry.keys || []).map((key) => (
            <div
              key={key}
              className="flex items-center gap-1.5 pl-2 pr-1 py-0.5 text-sm text-crimson-200 bg-crimson-900/70 rounded-md"
            >
              <span>{key}</span>
              <button
                type="button"
                onClick={() => handleRemoveKeyword(key)}
                className="p-0.5 rounded-full hover:bg-crimson-700"
                aria-label={`Remove keyword ${key}`}
              >
                <Icon name="close" className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <input
            ref={keyInputRef}
            type="text"
            onKeyDown={handleKeyInputKeyDown}
            onPaste={handlePaste}
            className="flex-grow bg-transparent outline-none text-sm p-1 placeholder:text-slate-500 min-w-[120px]"
            placeholder="Add tags..."
          />
        </div>
        {duplicateKeywords.length > 0 && (
          <div className="mt-2 text-xs text-amber-400 space-y-1">
            {duplicateKeywords.map((dup) => (
              <p key={dup.keyword}>
                <Icon
                  name="alert-triangle"
                  className="inline w-3.5 h-3.5 mr-1 align-text-bottom"
                />
                Warning: "<strong>{dup.keyword}</strong>" also in:{' '}
                {dup.entries.join(', ')}.
              </p>
            ))}
          </div>
        )}
      </InspectorSection>

      <InspectorSection title="Linked Lore" icon="book-open">
        <div className="p-2 bg-slate-800/50 border-2 border-slate-700 rounded-md min-h-[40px] flex flex-wrap gap-2 items-center">
          {linkedEntries.length > 0 ? (
            linkedEntries.map((linked) => (
              <div
                key={linked.id}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-crimson-300 bg-crimson-900/50 border border-crimson-700/50 rounded-full"
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
      </InspectorSection>
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entrySearch, setEntrySearch] = useState('');

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

  const handleEntryChange = <K extends keyof WorldEntry>(
    id: string,
    field: K,
    value: WorldEntry[K],
  ) => {
    setFormData((prev) => ({
      ...prev,
      entries: (prev.entries || []).map((entry): WorldEntry => {
        if (entry.id === id) {
          return { ...entry, [field]: value };
        }
        return entry;
      }),
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
          const newEntries = (prev.entries || []).filter(
            (e) => e.id !== entryId,
          );
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

  const activeEntry = useMemo(
    () => formData.entries?.find((e) => e.id === activeEntryId),
    [formData.entries, activeEntryId],
  );

  const filteredEntries = useMemo(() => {
    if (!entrySearch) return formData.entries || [];
    const query = entrySearch.toLowerCase();
    return (formData.entries || []).filter(
      (entry) =>
        (entry.name || '').toLowerCase().includes(query) ||
        (entry.keys || []).some(
          (key) => typeof key === 'string' && key.toLowerCase().includes(query),
        ),
    );
  }, [formData.entries, entrySearch]);

  const entriesByCategory = useMemo(() => {
    const UNCATEGORIZED = '(No Category)';
    const grouped: Record<string, WorldEntry[]> = {};
    filteredEntries.forEach((entry) => {
      const category = entry.category || UNCATEGORIZED;
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(entry);
    });
    return Object.entries(grouped).sort((a, b) => {
      if (a[0] === UNCATEGORIZED) return 1;
      if (b[0] === UNCATEGORIZED) return -1;
      return (
        categoryOptions.indexOf(a[0] as WorldEntryCategory) -
        categoryOptions.indexOf(b[0] as WorldEntryCategory)
      );
    });
  }, [filteredEntries]);

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
        className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] flex-1 overflow-hidden">
            {/* Left Column: Navigation & Entry List */}
            <aside className="w-full border-r border-slate-800 flex flex-col bg-slate-900/50">
              <div className="p-4 border-b border-slate-800 shrink-0 space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar
                    src={formData.avatar}
                    alt={formData.name || 'World'}
                    className="w-12 h-12"
                    shape="square"
                  />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full bg-transparent text-lg font-bold font-display tracking-wider border-0 focus:ring-0 p-0"
                    placeholder="World Name"
                    required
                  />
                </div>
                <div className="relative">
                  <Icon
                    name="search"
                    className="w-4 h-4 text-slate-500 absolute top-1/2 left-3 -translate-y-1/2"
                  />
                  <input
                    type="text"
                    value={entrySearch}
                    onChange={(e) => setEntrySearch(e.target.value)}
                    placeholder="Search entries..."
                    className="w-full bg-slate-800/60 border-2 border-slate-700 rounded-lg py-1.5 pl-9 pr-3 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddNewEntry}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-crimson-300 bg-crimson-900/50 border border-crimson-700/70 rounded-lg hover:bg-crimson-800/50 transition-colors"
                >
                  <Icon name="add" className="w-4 h-4" /> New Lore Entry
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {entriesByCategory.length > 0 ? (
                  entriesByCategory.map(([category, entries]) => (
                    <div key={category} className="mb-3">
                      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 px-2 py-1">
                        <Icon
                          name={
                            categoryIcons[category as WorldEntryCategory] ||
                            'book-open'
                          }
                          className="w-3.5 h-3.5"
                        />
                        {category}
                      </h3>
                      <div className="space-y-1 mt-1">
                        {entries.map((entry) => (
                          <button
                            type="button"
                            key={entry.id}
                            onClick={() => setActiveEntryId(entry.id)}
                            className={`w-full text-left p-2 rounded-md flex items-center justify-between group ${
                              activeEntryId === entry.id
                                ? 'bg-crimson-600/20'
                                : 'hover:bg-slate-800/70'
                            }`}
                          >
                            <span
                              className={`flex-1 truncate text-sm ${
                                activeEntryId === entry.id
                                  ? 'text-crimson-300 font-semibold'
                                  : 'text-slate-300'
                              }`}
                            >
                              {entry.name || 'Unnamed Entry'}
                            </span>
                            <div className="flex items-center">
                              {!entry.enabled && (
                                <Tooltip content="Disabled" position="top">
                                  <Icon
                                    name="minus-square"
                                    className="w-4 h-4 text-slate-500 mr-2"
                                  />
                                </Tooltip>
                              )}
                              <button
                                onClick={(e) => handleDeleteEntry(e, entry.id)}
                                className="p-1 text-slate-500 hover:text-ember-400 opacity-0 group-hover:opacity-100 focus:opacity-100"
                              >
                                <Icon name="delete" className="w-4 h-4" />
                              </button>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-600 p-8">
                    <Icon name="book-open" className="w-12 h-12 mx-auto" />
                    <p className="mt-2 text-sm">No lore entries yet.</p>
                  </div>
                )}
              </div>
            </aside>

            {/* Center Column: Editor */}
            <main className="w-full flex flex-col">
              {activeEntry ? (
                <>
                  <div className="p-4 border-b border-slate-800 shrink-0">
                    <input
                      type="text"
                      value={activeEntry.name || ''}
                      onChange={(e) =>
                        handleEntryChange(activeEntry.id, 'name', e.target.value)
                      }
                      className="w-full bg-transparent text-lg font-bold border-0 focus:ring-0 p-0"
                      placeholder="Entry Name"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto relative">
                    <textarea
                      value={activeEntry.content}
                      onChange={(e) =>
                        handleEntryChange(
                          activeEntry.id,
                          'content',
                          e.target.value,
                        )
                      }
                      className="w-full h-full bg-slate-950 p-4 resize-none border-0 focus:ring-0 custom-scrollbar absolute inset-0 text-sm leading-relaxed"
                      placeholder="Enter lore content here... You can use markdown for bold and italics."
                    />
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-600 text-center">
                  <div>
                    <Icon name="add" className="w-16 h-16 mx-auto" />
                    <p className="mt-4 font-semibold">
                      Create a new entry to get started.
                    </p>
                  </div>
                </div>
              )}
            </main>

            {/* Right Column: Inspector */}
            <aside className="w-full border-l border-slate-800 overflow-y-auto p-4 custom-scrollbar bg-slate-900/50">
              {activeEntry ? (
                <EntryInspectorPanel
                  entry={activeEntry}
                  allEntries={formData.entries || []}
                  onEntryChange={handleEntryChange}
                />
              ) : (
                <div className="text-center text-slate-600 pt-8">
                  <Icon name="settings" className="w-12 h-12 mx-auto" />
                  <p className="mt-2 text-sm">
                    Select an entry to edit its properties.
                  </p>
                </div>
              )}
            </aside>
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
              className="px-4 py-2 text-sm font-semibold text-white bg-crimson-600 hover:bg-crimson-500 rounded-lg transition-colors border border-crimson-400/50 shadow-md shadow-crimson-900/50"
            >
              Save World
            </button>
          </footer>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default WorldEditorPage;