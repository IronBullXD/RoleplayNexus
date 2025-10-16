import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { World, WorldEntry, WorldEntryCategory, ValidationIssue } from '../types';
import { Icon } from './Icon';
import Avatar from './Avatar';
import { useUIStore } from '../store/stores/uiStore';
import { useSettingsStore } from '../store/stores/settingsStore';
import { Tooltip } from './Tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { validateWorld, runConsistencyCheck } from '../services/worldValidationService';
import ValidationResultsPanel from './ValidationResultsPanel';
import { LLMProvider } from '../types';
import { useVirtualScroll } from '../hooks/useVirtualScroll';

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

// Type guard to safely check if a string is a valid WorldEntryCategory
const isWorldEntryCategory = (value: string): value is WorldEntryCategory => {
  return categoryOptions.includes(value as WorldEntryCategory);
};

interface EntryEditorProps {
  entry: WorldEntry;
  allEntries: WorldEntry[];
  onEntryChange: <K extends keyof WorldEntry>(
    id: string,
    field: K,
    value: WorldEntry[K],
  ) => void;
}

const EntryListItem = React.memo(({ entry, isActive, onSelect, onDelete }: {
  entry: WorldEntry;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (e: React.MouseEvent, id: string, name: string) => void;
}) => {
  const handleSelect = useCallback(() => onSelect(entry.id), [onSelect, entry.id]);
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(e, entry.id, entry.name || 'Unnamed Entry');
  }, [onDelete, entry.id, entry.name]);

  return (
    <button
      id={`entry-list-item-${entry.id}`}
      type="button"
      onClick={handleSelect}
      className={`w-full text-left p-2 rounded-md flex items-center justify-between group h-full ${
        isActive ? 'bg-crimson-600/20' : 'hover:bg-slate-800/70'
      }`}
    >
      <span
        className={`flex-1 truncate text-sm ${
          isActive ? 'text-crimson-300 font-semibold' : 'text-slate-300'
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
          type="button"
          onClick={handleDelete}
          className="p-1 text-slate-500 hover:text-ember-400 opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label={`Delete entry ${entry.name || 'Unnamed Entry'}`}
        >
          <Icon name="delete" className="w-4 h-4" />
        </button>
      </div>
    </button>
  );
});

const EntryInspectorPanel = React.memo(function EntryInspectorPanel({
  entry,
  allEntries,
  onEntryChange,
}: EntryEditorProps) {
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

  const processAndAddKeywords = useCallback(() => {
    const inputElement = keyInputRef.current;
    if (!inputElement || !inputElement.value.trim()) {
      return;
    }
    const inputValue = inputElement.value;
    const currentKeys: string[] = entry.keys || [];
    const lowercasedCurrentKeys = currentKeys.map((k) => k.toLowerCase());

    const newKeys = inputValue
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
      .filter((k) => !lowercasedCurrentKeys.includes(k.toLowerCase()));

    if (newKeys.length > 0) {
      // FIX: Changed `...Array.from(new Set(newKeys))` to `...newKeys` to avoid TypeScript type inference issues.
      // `newKeys` is already filtered for uniqueness against existing keys.
      onEntryChange(entry.id, 'keys', [...currentKeys, ...newKeys]);
    }
    inputElement.value = '';
  }, [entry.id, entry.keys, onEntryChange]);

  const handleRemoveKeyword = useCallback((keyToRemove: string) => {
    onEntryChange(
      entry.id,
      'keys',
      (entry.keys || []).filter((k) => k !== keyToRemove),
    );
  }, [entry.id, entry.keys, onEntryChange]);

  const handleKeyInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
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
  }, [processAndAddKeywords, handleRemoveKeyword, entry.keys]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const currentKeys: string[] = entry.keys || [];
    const lowercasedCurrentKeys = currentKeys.map((k) => k.toLowerCase());

    const pastedKeys = pastedText
      .split(/,|\n/)
      .map((key) => key.trim())
      .filter(Boolean)
      .filter((k) => !lowercasedCurrentKeys.includes(k.toLowerCase()));

    if (pastedKeys.length > 0) {
      // FIX: Changed `...Array.from(new Set(pastedKeys))` to `...pastedKeys` to avoid TypeScript type inference issues.
      // `pastedKeys` is already filtered for uniqueness against existing keys.
      onEntryChange(entry.id, 'keys', [...currentKeys, ...pastedKeys]);
    }
    if (keyInputRef.current) {
      keyInputRef.current.value = '';
    }
  }, [entry.id, entry.keys, onEntryChange]);

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
          onChange={(e) => {
            const value = e.target.value;
            onEntryChange(
              entry.id,
              'category',
              isWorldEntryCategory(value) ? value : undefined,
            );
          }}
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
});
EntryInspectorPanel.displayName = 'EntryInspectorPanel';

const QuickJumpModal = ({ entries, onSelect, onClose }: {
    entries: WorldEntry[];
    onSelect: (entryId: string) => void;
    onClose: () => void;
}) => {
    const [search, setSearch] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const filteredEntries = useMemo(() => {
        if (!search) return entries;
        const lowerSearch = search.toLowerCase();
        return entries.filter(e => e.name?.toLowerCase().includes(lowerSearch));
    }, [search, entries]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/70 z-10 flex justify-center pt-20"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-lg shadow-2xl flex flex-col max-h-[60vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-3 border-b border-slate-800">
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Jump to entry..."
                        className="w-full bg-slate-800 border-slate-700 rounded-md p-2 text-sm focus:ring-crimson-500 focus:border-crimson-500"
                    />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {filteredEntries.map(entry => (
                        <button
                            key={entry.id}
                            type="button"
                            onClick={() => onSelect(entry.id)}
                            className="w-full text-left p-2 rounded-md hover:bg-slate-800 text-slate-300 hover:text-crimson-300 text-sm"
                        >
                            {entry.name || 'Unnamed Entry'}
                        </button>
                    ))}
                </div>
            </motion.div>
        </motion.div>
    );
};

const ListHeader: React.FC<{ label: string; icon: string; color: string; }> = ({ label, icon, color }) => (
    <h3 className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${color} px-2 py-1 h-full`}>
        <Icon name={icon} className="w-3.5 h-3.5" />
        {label}
    </h3>
);


const WorldEditorPage: React.FC<WorldEditorPageProps> = ({
  world,
  onSave,
  onClose,
}) => {
  const requestConfirmation = useUIStore(state => state.requestConfirmation);
  const settings = useSettingsStore(state => state.settings);
  const [formData, setFormData] = useState<Partial<World>>({
    name: '',
    avatar: '',
    description: '',
    entries: [],
  });
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const entryListRef = useRef<HTMLDivElement>(null);
  const [entrySearch, setEntrySearch] = useState('');
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [isValidationPanelOpen, setIsValidationPanelOpen] = useState(false);
  const [includeAiCheck, setIncludeAiCheck] = useState(false);
  const [isCheckingConsistency, setIsCheckingConsistency] = useState(false);
  const [recentEntryIds, setRecentEntryIds] = useState<string[]>([]);
  const [isQuickJumpOpen, setIsQuickJumpOpen] = useState(false);


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
    setIsValidationPanelOpen(false);
    setValidationIssues([]);
    setRecentEntryIds([]);
  }, [world]);

  useEffect(() => {
      if (activeEntryId) {
          setRecentEntryIds(prev => {
              const newRecents = [activeEntryId, ...prev.filter(id => id !== activeEntryId)];
              return newRecents.slice(0, 5); // Keep last 5
          });
      }
  }, [activeEntryId]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFormData((p) => ({ ...p, [e.target.name]: e.target.value })),
    [],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
        const reader = new FileReader();
        reader.onloadend = () =>
          setFormData((p) => ({ ...p, avatar: reader.result as string }));
        reader.readAsDataURL(e.target.files[0]);
      }
    },
    [],
  );

  const handleEntryChange = useCallback(<K extends keyof WorldEntry>(
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
  }, []);

  const handleAddNewEntry = useCallback(() => {
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
  }, []);

  const handleSelectEntry = useCallback((id: string) => {
    setActiveEntryId(id);
  }, []);
  
  const handleDeleteEntry = useCallback(
    (e: React.MouseEvent, entryId: string, entryName: string) => {
      e.stopPropagation();
      requestConfirmation(
        () => {
          setFormData((prev) => {
            const newEntries = (prev.entries || []).filter(
              (e) => e.id !== entryId,
            );
            setActiveEntryId((currentActiveId) => {
              if (currentActiveId === entryId) {
                return newEntries.length > 0 ? newEntries[0].id : null;
              }
              return currentActiveId;
            });
            return { ...prev, entries: newEntries };
          });
        },
        'Delete Entry',
        `Are you sure you want to delete "${
          entryName || 'Unnamed Entry'
        }"?`,
        'Delete',
        'danger',
      );
    },
    [requestConfirmation],
  );

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const finalEntries = (formData.entries || []).map((entry) => ({
      ...entry,
      keys: (entry.keys || []).map((k) => k.trim()).filter(Boolean),
    }));
    // Construct a valid World object to avoid `as` casting and ensure type safety.
    const worldToSave: World = {
      id: formData.id || crypto.randomUUID(),
      name: formData.name || 'Unnamed World',
      description: formData.description || '', // Provide default for required field
      avatar: formData.avatar, // Optional field, can be undefined
      entries: finalEntries,
    };
    onSave(worldToSave);
  }, [formData, onSave]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isValidationPanelOpen && !isCheckingConsistency && !isQuickJumpOpen) onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsQuickJumpOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onClose, isValidationPanelOpen, isCheckingConsistency, isQuickJumpOpen]);

  const handleValidate = useCallback(async () => {
    const currentWorld = formData as World;
    const localIssues = validateWorld(currentWorld);
    let allIssues = [...localIssues];
    
    if (includeAiCheck) {
        setIsCheckingConsistency(true);
        try {
            const { provider, apiKeys, models } = settings;
            const apiKey = provider === LLMProvider.GEMINI ? (process.env.API_KEY || '') : apiKeys[provider];
            const model = models?.[provider];
            if (!model || !apiKey) {
                throw new Error(`API key or model is not configured for ${provider}. Please check your settings.`);
            }

            const aiIssues = await runConsistencyCheck({ world: currentWorld, provider, apiKey, model });
            allIssues = [...allIssues, ...aiIssues];
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            const errorIssue: ValidationIssue = {
                type: 'Contradiction',
                severity: 'error',
                message: `AI consistency check failed: ${errorMessage}`,
                entryIds: []
            };
            allIssues.push(errorIssue);
        } finally {
            setIsCheckingConsistency(false);
        }
    }
    
    setValidationIssues(allIssues);
    setIsValidationPanelOpen(true);
  }, [formData, includeAiCheck, settings]);

  const handleSelectEntryFromIssue = useCallback((entryId: string) => {
    setActiveEntryId(entryId);
    setIsValidationPanelOpen(false);
  }, []);
  
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

  const ITEM_HEIGHT = 36; // px

  type ListItem =
    | { type: 'header'; id: string; label: string; icon: string; color: string; }
    | { type: 'entry'; data: WorldEntry };

  const displayList = useMemo<ListItem[]>(() => {
    const list: ListItem[] = [];
    const recent = recentEntryIds
        .map(id => filteredEntries.find(e => e.id === id))
        .filter((e): e is WorldEntry => !!e);
    
    const specialIds = new Set(recent.map(e => e.id));
    const mainEntries = filteredEntries.filter(e => !specialIds.has(e.id));
    
    const UNCATEGORIZED = '(No Category)';
    const grouped: Record<string, WorldEntry[]> = {};
    mainEntries.forEach((entry) => {
        const category = entry.category || UNCATEGORIZED;
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(entry);
    });

    if (recent.length > 0) {
        list.push({ type: 'header', id: 'header-recent', label: 'Recent', icon: 'history', color: 'text-sky-400' });
        recent.forEach(entry => list.push({ type: 'entry', data: entry }));
    }

    Object.entries(grouped)
        .sort(([aCat], [bCat]) => {
            if (aCat === UNCATEGORIZED) return 1;
            if (bCat === UNCATEGORIZED) return -1;
            const aIndex = isWorldEntryCategory(aCat) ? categoryOptions.indexOf(aCat) : -1;
            const bIndex = isWorldEntryCategory(bCat) ? categoryOptions.indexOf(bCat) : -1;
            return aIndex - bIndex;
        })
        .forEach(([category, entries]) => {
            list.push({ type: 'header', id: `header-cat-${category}`, label: category, icon: categoryIcons[category as WorldEntryCategory] || 'book-open', color: 'text-slate-500' });
            entries.forEach(entry => list.push({ type: 'entry', data: entry }));
        });
      
    return list;
  }, [filteredEntries, recentEntryIds]);

  const { handleScroll, virtualItems, totalHeight } = useVirtualScroll({
    items: displayList,
    itemHeight: ITEM_HEIGHT,
    containerRef: entryListRef,
  });

  return (
    <>
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
          <header className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2 text-xl font-bold font-display tracking-widest uppercase">
                <span className="text-slate-400">Worlds</span>
                <span className="text-slate-600">/</span>
                <span className="text-crimson-400">{formData.name || '...'}</span>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md">
                <Icon name="close" />
            </button>
          </header>
          <form
            onSubmit={handleSubmit}
            className="flex-1 flex flex-col overflow-hidden relative"
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
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Icon
                        name="search"
                        className="w-4 h-4 text-slate-500 absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none"
                      />
                      <input
                        type="text"
                        value={entrySearch}
                        onChange={(e) => setEntrySearch(e.target.value)}
                        placeholder="Search entries..."
                        className="w-full bg-slate-800/60 border-2 border-slate-700 rounded-lg py-1.5 pl-9 pr-3 text-sm"
                      />
                    </div>
                    <Tooltip content="Quick Jump (Ctrl+K)" position="top">
                        <button type="button" onClick={() => setIsQuickJumpOpen(true)} className="p-2 text-slate-400 bg-slate-800/60 border-2 border-slate-700 rounded-lg hover:bg-slate-700/50">
                           <Icon name="zap" className="w-4 h-4" />
                        </button>
                    </Tooltip>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddNewEntry}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-crimson-300 bg-crimson-900/50 border border-crimson-700/70 rounded-lg hover:bg-crimson-800/50 transition-colors"
                  >
                    <Icon name="add" className="w-4 h-4" /> New Lore Entry
                  </button>
                </div>
                
                <div ref={entryListRef} onScroll={handleScroll} className="flex-1 overflow-y-auto custom-scrollbar p-2 relative">
                    {displayList.length > 0 ? (
                        <>
                            <div style={{ height: `${totalHeight}px`, position: 'relative', width: '100%' }} />
                            {virtualItems.map(({ data: item, style }) => (
                                <div key={item.type === 'entry' ? item.data.id : item.id} style={style}>
                                    {item.type === 'header' ? (
                                        <ListHeader label={item.label} icon={item.icon} color={item.color} />
                                    ) : (
                                        <EntryListItem
                                            entry={item.data}
                                            isActive={activeEntryId === item.data.id}
                                            onSelect={handleSelectEntry}
                                            onDelete={handleDeleteEntry}
                                        />
                                    )}
                                </div>
                            ))}
                        </>
                    ) : (
                         <div className="text-center text-slate-600 p-8">
                            <Icon name={entrySearch ? "search" : "book-open"} className="w-12 h-12 mx-auto" />
                            <p className="mt-2 text-sm">{entrySearch ? "No entries match your search." : "No lore entries yet."}</p>
                         </div>
                    )}
                </div>
              </aside>

              {/* Center Column: Editor */}
              <main className="w-full flex flex-col">
                {activeEntry ? (
                  <>
                    <div className="p-4 border-b border-slate-800 shrink-0 flex items-center gap-2">
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
            <footer className="p-4 border-t border-slate-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleValidate}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 hover:bg-slate-700 rounded-md transition-colors border border-slate-600"
                >
                  <Icon name="shield-check" className="w-4 h-4" /> Validate World
                </button>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-400 hover:text-white">
                    <input 
                        type="checkbox"
                        checked={includeAiCheck}
                        onChange={e => setIncludeAiCheck(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-crimson-500 focus:ring-crimson-500"
                    />
                    <span className="flex items-center gap-1.5">
                      <Icon name="brain" className="w-4 h-4 text-purple-400" />
                      Include AI Consistency Check
                    </span>
                </label>
              </div>
              <div className="flex items-center space-x-3">
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
              </div>
            </footer>
            <AnimatePresence>
                {isQuickJumpOpen && <QuickJumpModal 
                    entries={formData.entries || []}
                    onSelect={(id) => {
                        setActiveEntryId(id);
                        setIsQuickJumpOpen(false);
                    }}
                    onClose={() => setIsQuickJumpOpen(false)}
                />}
            </AnimatePresence>
          </form>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {isCheckingConsistency && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 flex flex-col items-center justify-center z-[70] backdrop-blur-sm gap-4"
            >
              <Icon name="redo" className="w-10 h-10 text-crimson-400 animate-spin" />
              <p className="text-lg font-display tracking-wider uppercase text-slate-300">
                AI is checking for inconsistencies...
              </p>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isValidationPanelOpen && (
          <ValidationResultsPanel 
            issues={validationIssues}
            onClose={() => setIsValidationPanelOpen(false)}
            onSelectEntry={handleSelectEntryFromIssue}
            worldName={formData.name || 'Unnamed World'}
            entries={formData.entries || []}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default WorldEditorPage;