import React, { useState, useEffect, useRef, useMemo } from 'react';
import { World, WorldEntry, WorldEntryCategory } from '../types';
import { Icon } from './Icon';
import Avatar from './Avatar';
import { useAppContext } from '../contexts/AppContext';
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
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  indeterminate?: boolean;
  id: string;
}> = ({ checked, onChange, indeterminate = false, id }) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <div className="relative flex items-center justify-center w-5 h-5">
      <input
        ref={ref}
        type="checkbox"
        id={id}
        checked={checked}
        onChange={onChange}
        className="appearance-none w-5 h-5 border-2 border-slate-600 rounded-md checked:bg-sky-500 checked:border-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-sky-500 transition-colors"
      />
      {checked && !indeterminate && <Icon name="checkmark" className="w-4 h-4 text-white absolute pointer-events-none" />}
      {indeterminate && <div className="w-2.5 h-1 bg-sky-500 rounded-sm absolute pointer-events-none" />}
    </div>
  );
};


const CategoryAccordion: React.FC<{
  category: WorldEntryCategory;
  entries: { entry: WorldEntry; originalIndex: number }[];
  allEntries: WorldEntry[];
  selectedIndices: Set<number>;
  onAddEntry: (category: WorldEntryCategory) => void;
  onRemoveEntry: (originalIndex: number) => void;
  onEntryChange: (originalIndex: number, field: keyof WorldEntry, value: string | boolean | WorldEntryCategory) => void;
  onToggleSelection: (originalIndex: number) => void;
  onToggleCategorySelection: (category: WorldEntryCategory) => void;
  expandedEntryIds: Set<string>;
  onToggleEntryExpansion: (entryId: string) => void;
}> = ({ category, entries, allEntries, selectedIndices, onAddEntry, onRemoveEntry, onEntryChange, onToggleSelection, onToggleCategorySelection, expandedEntryIds, onToggleEntryExpansion }) => {
  const [isOpen, setIsOpen] = useState(entries.length > 0);
  const iconName = categoryIcons[category] || 'book-open';
  
  const categoryIndices = useMemo(() => new Set(entries.map(e => e.originalIndex)), [entries]);
  const selectedInCategory = useMemo(() => {
    const selected = new Set<number>();
    for (const index of selectedIndices) {
      if (categoryIndices.has(index)) {
        selected.add(index);
      }
    }
    return selected;
  }, [selectedIndices, categoryIndices]);

  const isAllSelected = selectedInCategory.size > 0 && selectedInCategory.size === entries.length;
  const isPartiallySelected = selectedInCategory.size > 0 && selectedInCategory.size < entries.length;


  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-3 bg-slate-900/30 hover:bg-slate-900/60 transition-colors text-left">
        <div className="flex items-center gap-3">
          <CustomCheckbox id={`select-all-${category}`} checked={isAllSelected} indeterminate={isPartiallySelected} onChange={() => onToggleCategorySelection(category)} />
          <Icon name={iconName} className="w-5 h-5 text-sky-400" />
          <span className="font-semibold text-slate-200">{category}</span>
          <span className="text-sm text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">{entries.length}</span>
        </div>
        <Icon name="chevron-down" className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="bg-black/20 animate-fade-in">
          {entries.length > 0 ? entries.map(({ entry, originalIndex }) => {
            const isExpanded = expandedEntryIds.has(entry.id);
            
            let linkedEntries: WorldEntry[] = [];
            if (isExpanded && entry.content) {
                const linked = new Map<string, WorldEntry>();
                const currentContent = entry.content.toLowerCase();

                for (const otherEntry of allEntries) {
                    if (otherEntry.id === entry.id || !otherEntry.keys || otherEntry.keys.length === 0) continue;

                    for (const key of otherEntry.keys) {
                        if (key.trim().length < 3) continue;
                        try {
                            const regex = new RegExp(`\\b${key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
                            if (currentContent.match(regex)) {
                                linked.set(otherEntry.id, otherEntry);
                                break;
                            }
                        } catch (e) { console.warn(`Invalid regex from key: ${key}`, e); }
                    }
                }
                linkedEntries = Array.from(linked.values());
            }

            return (
               <div key={entry.id} className={`p-3 border-b border-slate-700/50 last:border-b-0 transition-colors ${selectedIndices.has(originalIndex) ? 'bg-sky-900/40' : 'hover:bg-slate-800/40'}`}>
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5"><CustomCheckbox id={`select-${originalIndex}`} checked={selectedIndices.has(originalIndex)} onChange={() => onToggleSelection(originalIndex)} /></div>
                        <button type="button" onClick={() => onToggleEntryExpansion(entry.id)} className="flex items-start gap-2 text-left flex-1 min-w-0">
                            <Icon name="chevron-down" className={`w-5 h-5 text-slate-400 transition-transform shrink-0 mt-0.5 ${isExpanded ? 'rotate-180' : ''}`} />
                            <div className="flex-1">
                                <div className="flex items-center gap-1.5">
                                    {entry.isAlwaysActive && (
                                        <Tooltip content="'Always Active' entries are always included in context and appear first.">
                                            <Icon name="pin" className="w-4 h-4 text-fuchsia-400 shrink-0" />
                                        </Tooltip>
                                    )}
                                    <span className="font-semibold text-slate-200">{entry.name || 'Unnamed Entry'}</span>
                                </div>
                                {!isExpanded && entry.keys && entry.keys.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {entry.keys.slice(0, 5).map(key => (
                                            <span key={key} className="px-1.5 py-0.5 text-xs text-slate-400 bg-slate-700/50 rounded">
                                                {key}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </button>
                        <button type="button" onClick={() => onRemoveEntry(originalIndex)} className="p-1.5 text-slate-500 hover:text-fuchsia-500 hover:bg-slate-700/50 rounded-md transition-colors shrink-0" aria-label="Delete entry">
                            <Icon name="delete" className="w-5 h-5" />
                        </button>
                    </div>

                    {isExpanded && (
                        <div className="pl-12 pr-4 pb-4 pt-3 space-y-4 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                {/* Left Column */}
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor={`entry-name-${originalIndex}`} className="block text-xs font-medium text-slate-400 mb-1">Entry Name</label>
                                        <input
                                            type="text" id={`entry-name-${originalIndex}`} value={entry.name || ''}
                                            onChange={(e) => onEntryChange(originalIndex, 'name', e.target.value)}
                                            className="block w-full bg-slate-950 border-2 border-slate-700 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm p-2 placeholder:text-slate-600"
                                            placeholder="e.g., The Silver Dragon Inn"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor={`entry-keys-${originalIndex}`} className="block text-xs font-medium text-slate-400 mb-1">Keywords (comma-separated)</label>
                                        <input
                                            type="text" id={`entry-keys-${originalIndex}`} value={(entry.keys || []).join(',')}
                                            onChange={(e) => onEntryChange(originalIndex, 'keys', e.target.value)}
                                            className="block w-full bg-slate-950 border-2 border-slate-700 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm p-2 placeholder:text-slate-600"
                                            placeholder="inn, tavern, rest"
                                        />
                                    </div>
                                </div>
                                {/* Right Column */}
                                <div className="space-y-4">
                                    <div>
                                      <label htmlFor={`entry-category-${originalIndex}`} className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                                      <select
                                          id={`entry-category-${originalIndex}`}
                                          value={entry.category || WorldEntryCategory.LORE}
                                          onChange={(e) => onEntryChange(originalIndex, 'category', e.target.value as WorldEntryCategory)}
                                          className="block w-full bg-slate-950 border-2 border-slate-700 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm p-2"
                                      >
                                          {categoryOptions.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                                      <div className="flex items-center gap-6 pt-2">
                                         <label htmlFor={`entry-enabled-${originalIndex}`} className="flex items-center cursor-pointer group/toggle">
                                              <div className="relative">
                                                  <input type="checkbox" id={`entry-enabled-${originalIndex}`} checked={entry.enabled} onChange={(e) => onEntryChange(originalIndex, 'enabled', e.target.checked)} className="sr-only" />
                                                  <div className={`block w-10 h-6 rounded-full transition-colors ${entry.enabled ? 'bg-sky-500' : 'bg-slate-700'}`}></div>
                                                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${entry.enabled ? 'translate-x-4' : ''}`}></div>
                                              </div>
                                              <span className="text-sm font-medium text-slate-300 ml-3 group-hover/toggle:text-white transition-colors">Enabled</span>
                                         </label>
                                          <label htmlFor={`entry-always-active-${originalIndex}`} className="flex items-center cursor-pointer group/toggle">
                                              <div className="relative">
                                                  <input type="checkbox" id={`entry-always-active-${originalIndex}`} checked={!!entry.isAlwaysActive} onChange={(e) => onEntryChange(originalIndex, 'isAlwaysActive', e.target.checked)} className="sr-only" />
                                                  <div className={`block w-10 h-6 rounded-full transition-colors ${entry.isAlwaysActive ? 'bg-fuchsia-500' : 'bg-slate-700'}`}></div>
                                                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${entry.isAlwaysActive ? 'translate-x-4' : ''}`}></div>
                                              </div>
                                              <span className="text-sm font-medium text-slate-300 ml-3 group-hover/toggle:text-white transition-colors">Always Active</span>
                                          </label>
                                      </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label htmlFor={`entry-content-${originalIndex}`} className="block text-xs font-medium text-slate-400 mb-1">Content</label>
                                <textarea
                                    id={`entry-content-${originalIndex}`} value={entry.content} onChange={(e) => onEntryChange(originalIndex, 'content', e.target.value)}
                                    rows={4}
                                    className="block w-full bg-slate-950 border-2 border-slate-700 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm p-2 placeholder:text-slate-600 custom-scrollbar"
                                    placeholder="Details about this lore entry..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Linked Lore (Auto-detected)</label>
                                <div className="p-2 bg-slate-950 border-2 border-slate-700 rounded-md min-h-[40px] flex flex-wrap gap-2 items-center">
                                    {linkedEntries.length > 0 ? (
                                        linkedEntries.map(linkedEntry => (
                                            <div key={linkedEntry.id} className="flex items-center gap-1.5 px-2 py-1 text-xs text-sky-300 bg-sky-900/50 border border-sky-700/50 rounded-full">
                                                <Icon name={categoryIcons[linkedEntry.category || WorldEntryCategory.LORE] || 'book-open'} className="w-3 h-3" />
                                                <span>{linkedEntry.name || 'Unnamed'}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-slate-500 italic px-1">No keywords from other entries found in this content.</p>
                                    )}
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            )
          }) : (
            <p className="text-center text-sm text-slate-500 p-4">No entries in this category.</p>
          )}
          <div className="p-3">
            <button type="button" onClick={() => onAddEntry(category)} className="w-full text-center px-4 py-2 text-sm font-semibold text-sky-300 bg-sky-900/50 border border-sky-700/70 rounded-lg hover:bg-sky-800/50 transition-colors">
              Add {category} Entry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


const WorldEditorPage: React.FC<WorldEditorPageProps> = ({ world, onSave, onClose }) => {
  const { requestConfirmation } = useAppContext();
  const [formData, setFormData] = useState<Partial<World>>({ name: '', avatar: '', description: '', entries: [], });
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMoveToOpen, setIsMoveToOpen] = useState(false);
  const moveToRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (world) {
      let processedEntries = world.entries;
      const legacyContent = (world as any).content;
      if (typeof legacyContent === 'string' && !world.entries) {
        processedEntries = [{ id: crypto.randomUUID(), name: world.name ? `${world.name} General` : 'General Lore', keys: world.name ? [world.name.toLowerCase(), 'general'] : ['general'], content: legacyContent, enabled: true, isAlwaysActive: true, category: WorldEntryCategory.LORE }];
      }
      
      if (processedEntries) {
        processedEntries = processedEntries.map(e => ({ ...e, id: e.id || crypto.randomUUID() }));
      }

      const newFormData = { ...world, entries: processedEntries };
      setFormData(newFormData);
      
      // FIX: Conditionally expand entries to avoid cluttering the UI on worlds with many entries.
      if (newFormData.entries && newFormData.entries.length > 5) {
          setExpandedEntryIds(new Set());
      } else if (newFormData.entries) {
          setExpandedEntryIds(new Set(newFormData.entries.map(e => e.id)));
      }
    }
  }, [world]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (moveToRef.current && !moveToRef.current.contains(event.target as Node)) {
            setIsMoveToOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) { const reader = new FileReader(); reader.onloadend = () => setFormData(p => ({ ...p, avatar: reader.result as string })); reader.readAsDataURL(e.target.files[0]); } };

  const handleEntryChange = (index: number, field: keyof WorldEntry, value: string | boolean | WorldEntryCategory) => {
    setFormData(prev => {
      const newEntries = [...(prev.entries || [])];
      const entryToUpdate = { ...newEntries[index] };
      if (field === 'keys') {
        // Just split by comma. Don't trim or filter during editing to avoid breaking user input.
        entryToUpdate.keys = (value as string).split(',');
      } else {
        (entryToUpdate as any)[field] = value;
      }
      newEntries[index] = entryToUpdate;
      return { ...prev, entries: newEntries };
    });
  };
  
  const handleAddEntry = (category: WorldEntryCategory) => {
    const newEntry: WorldEntry = { id: crypto.randomUUID(), name: '', keys: [], content: '', enabled: true, category, isAlwaysActive: false };
    setFormData(prev => ({ ...prev, entries: [...(prev.entries || []), newEntry] }));
    setExpandedEntryIds(prev => new Set(prev).add(newEntry.id));
  };

  const handleRemoveEntry = (indexToRemove: number) => {
    const entryToRemove = (formData.entries || [])[indexToRemove];
    if (entryToRemove) {
        setExpandedEntryIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(entryToRemove.id);
            return newSet;
        });
    }
    setFormData(prev => ({ ...prev, entries: (prev.entries || []).filter((_, i) => i !== indexToRemove) }));

    // FIX: Update selected indices to prevent mismatches after an item is removed.
    setSelectedIndices(prev => {
      const newSet = new Set<number>();
      prev.forEach(selectedIndex => {
        if (selectedIndex < indexToRemove) {
          newSet.add(selectedIndex);
        } else if (selectedIndex > indexToRemove) {
          newSet.add(selectedIndex - 1);
        }
      });
      return newSet;
    });
  };

  const handleToggleSelection = (index: number) => {
    setSelectedIndices(prev => { const newSet = new Set(prev); if (newSet.has(index)) newSet.delete(index); else newSet.add(index); return newSet; });
  };

  const handleToggleCategorySelection = (category: WorldEntryCategory) => {
    setSelectedIndices(prev => {
        const newSet = new Set(prev);
        const categoryIndices = (formData.entries || []).map((e, i) => (e.category === category || (!e.category && category === WorldEntryCategory.LORE)) ? i : -1).filter(i => i !== -1);
        const areAllSelected = categoryIndices.every(i => newSet.has(i));
        if (areAllSelected) categoryIndices.forEach(i => newSet.delete(i));
        else categoryIndices.forEach(i => newSet.add(i));
        return newSet;
    });
  };

  const handleBulkUpdate = (updates: Partial<WorldEntry>) => {
    setFormData(prev => ({ ...prev, entries: (prev.entries || []).map((entry, index) => selectedIndices.has(index) ? { ...entry, ...updates } : entry) }));
  };

  const handleBulkDelete = () => {
    requestConfirmation(
      () => {
        const entriesToDelete = (formData.entries || []).filter((_, index) => selectedIndices.has(index));
        const idsToDelete = new Set(entriesToDelete.map(e => e.id));
        
        setExpandedEntryIds(prev => {
            const newSet = new Set(prev);
            idsToDelete.forEach(id => newSet.delete(id));
            return newSet;
        });
        
        setFormData(prev => ({ ...prev, entries: (prev.entries || []).filter((_, index) => !selectedIndices.has(index)) }));
        setSelectedIndices(new Set());
      },
      'Delete Entries',
      `Are you sure you want to permanently delete ${selectedIndices.size} selected lorebook entries?`,
      'Delete', 'danger'
    );
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalEntries = (formData.entries || []).map(entry => ({
      ...entry,
      keys: (entry.keys || []).map(k => k.trim()).filter(Boolean),
    }));
    onSave({ 
      id: formData.id || crypto.randomUUID(), 
      name: formData.name || 'Unnamed World', 
      description: formData.description || '', 
      avatar: formData.avatar || '', 
      entries: finalEntries
    });
  };
  
  useEffect(() => { const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', handleKeyDown); return () => document.removeEventListener('keydown', handleKeyDown); }, [onClose]);

  const entriesByCategory = useMemo(() => {
    const grouped: Record<WorldEntryCategory, { entry: WorldEntry; originalIndex: number }[]> = {} as any;
    for (const category of categoryOptions) { grouped[category] = []; }
    (formData.entries || []).forEach((entry, originalIndex) => { const category = entry.category || WorldEntryCategory.LORE; if (grouped[category]) { grouped[category].push({ entry, originalIndex }); } });
    for (const category in grouped) {
      grouped[category as WorldEntryCategory].sort((a, b) => {
        if (a.entry.isAlwaysActive && !b.entry.isAlwaysActive) return -1;
        if (!a.entry.isAlwaysActive && b.entry.isAlwaysActive) return 1;
        return (a.entry.name || '').localeCompare(b.entry.name || '');
      });
    }
    return grouped;
  }, [formData.entries]);

  return (
    <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-700 animate-slide-up" onClick={e => e.stopPropagation()}>
        <header className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold font-display tracking-widest uppercase">{world?.id ? 'Edit World' : 'Create World'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md"><Icon name="close" /></button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            {/* --- TOP SECTION: WORLD DETAILS --- */}
            <div className="p-6 border-b border-slate-800 shrink-0">
                <div className="flex items-center space-x-6">
                    <Avatar src={formData.avatar} alt={formData.name || 'World'} className="w-24 h-24" shape="square" />
                    <div className="flex-1">
                        <label htmlFor="name" className="block text-sm font-medium text-slate-300">World Name</label>
                        <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-lg p-3 placeholder:text-slate-600" required />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm text-sky-400 hover:underline mt-2">Upload Image</button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    </div>
                </div>
                 <div className="mt-4">
                    <label htmlFor="description" className="block text-sm font-medium text-slate-300">Description</label>
                    <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={2} className="mt-1 block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm p-3 placeholder:text-slate-600 custom-scrollbar" placeholder="A brief summary of this world." />
                </div>
            </div>

            {/* --- MIDDLE SECTION: LOREBOOK HEADER / ACTION BAR --- */}
            <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-800 shrink-0">
                 {selectedIndices.size === 0 ? (
                    <h3 className="text-lg font-medium text-slate-200 font-display tracking-wider">LOREBOOK ENTRIES</h3>
                 ) : (
                    <div className="flex items-center justify-between gap-4 animate-fade-in">
                        <div className="flex items-center gap-3">
                           <p className="text-sm font-semibold text-slate-200 shrink-0">{selectedIndices.size} item(s) selected</p>
                           <button type="button" onClick={() => setSelectedIndices(new Set())} className="text-sm font-medium text-sky-400 hover:text-white hover:underline shrink-0">Clear</button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                           <button type="button" onClick={() => handleBulkUpdate({ enabled: true })} className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition-colors">Enable</button>
                           <button type="button" onClick={() => handleBulkUpdate({ enabled: false })} className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition-colors">Disable</button>
                           
                           <div className="relative" ref={moveToRef}>
                              <button
                                  type="button"
                                  onClick={() => setIsMoveToOpen(prev => !prev)}
                                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5"
                              >
                                  <span>Move to...</span>
                                  <Icon name="chevron-down" className={`w-3 h-3 transition-transform ${isMoveToOpen ? 'rotate-180' : ''}`} />
                              </button>
                              {isMoveToOpen && (
                                  <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-20 py-1 animate-fade-in">
                                      {categoryOptions.map(cat => (
                                          <button
                                              key={cat}
                                              type="button"
                                              onClick={() => {
                                                  handleBulkUpdate({ category: cat });
                                                  setIsMoveToOpen(false);
                                              }}
                                              className="block w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-sky-600 hover:text-white transition-colors"
                                          >
                                              {cat}
                                          </button>
                                      ))}
                                  </div>
                              )}
                          </div>

                           <button type="button" onClick={handleBulkDelete} className="px-3 py-1.5 text-xs font-semibold rounded-md bg-fuchsia-600/20 hover:bg-fuchsia-600/40 text-fuchsia-400 transition-colors">Delete</button>
                        </div>
                    </div>
                )}
            </div>
            
            {/* --- BOTTOM SECTION: SCROLLABLE ENTRIES --- */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                {categoryOptions.map(category => ( entriesByCategory[category] && <CategoryAccordion 
                    key={category} 
                    category={category} 
                    entries={entriesByCategory[category]} 
                    allEntries={formData.entries || []}
                    selectedIndices={selectedIndices} 
                    onAddEntry={handleAddEntry} 
                    onRemoveEntry={handleRemoveEntry} 
                    onEntryChange={handleEntryChange} 
                    onToggleSelection={handleToggleSelection} 
                    onToggleCategorySelection={handleToggleCategorySelection} 
                    expandedEntryIds={expandedEntryIds}
                    onToggleEntryExpansion={(entryId) => {
                        setExpandedEntryIds(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(entryId)) newSet.delete(entryId);
                            else newSet.add(entryId);
                            return newSet;
                        });
                    }}
                /> ))}
            </div>
            
            <footer className="p-4 border-t border-slate-800 flex justify-end space-x-3 shrink-0">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 border border-slate-600 hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors border border-sky-400/50 shadow-md shadow-sky-900/50">Save World</button>
            </footer>
        </form>
      </div>
    </div>
  );
};

export default WorldEditorPage;