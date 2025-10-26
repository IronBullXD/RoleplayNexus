import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { World, WorldEntry, WorldEntryCategory } from '../types';
import { Icon } from './Icon';
import { motion } from 'framer-motion';
import { useSettingsStore } from '../store/stores/settingsStore';
import { generateWorldFromConcept, refineWorldWithInstruction } from '../services/llmService';
import { LLMProvider } from '../types';
import { logger } from '../services/logger';
import { Tooltip } from './Tooltip';

interface AIWorldEditorProps {
  world?: Partial<World> | null;
  onSave: (world: World) => void;
  onClose: () => void;
}

type EditorState = 'CONCEPT' | 'GENERATING' | 'REFINING' | 'AI_REFINING';

const categoryIcons: Record<WorldEntryCategory, string> = {
  [WorldEntryCategory.CHARACTER]: 'character',
  [WorldEntryCategory.LOCATION]: 'map-pin',
  [WorldEntryCategory.ITEM]: 'cube',
  [WorldEntryCategory.FACTION]: 'shield',
  [WorldEntryCategory.LORE]: 'book-open',
  [WorldEntryCategory.EVENT]: 'calendar',
  [WorldEntryCategory.WORLD]: 'globe',
  [WorldEntryCategory.MONSTER_CREATURE]: 'bug',
  [WorldEntryCategory.ORGANIZATION]: 'users-2',
};
const categoryOptions = Object.values(WorldEntryCategory);
const isWorldEntryCategory = (value: string): value is WorldEntryCategory => {
  return categoryOptions.includes(value as WorldEntryCategory);
};

const ConceptScreen: React.FC<{
    concept: string;
    setConcept: (c: string) => void;
    handleGenerate: () => void;
    error: string | null;
    disabled: boolean;
}> = ({ concept, setConcept, handleGenerate, error, disabled }) => (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Icon name="sparkles" className="w-16 h-16 text-purple-400 mb-4" />
        <h2 className="text-3xl font-bold font-display text-slate-100">Describe Your World</h2>
        <p className="mt-2 text-slate-400 max-w-lg">Write a few sentences about your world concept, and the AI will generate a detailed starting point with characters, locations, and lore.</p>
        <textarea 
            value={concept}
            onChange={e => setConcept(e.target.value)}
            placeholder="e.g., A dieselpunk city floating in the clouds, ruled by airship pirates and guilds fighting over a rare fuel source called 'Aetherium'."
            className="w-full max-w-2xl h-40 mt-6 bg-slate-950 border-2 border-slate-700 rounded-lg p-4 focus:ring-purple-500 focus:border-purple-500 custom-scrollbar"
            disabled={disabled}
        />
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        <button onClick={handleGenerate} disabled={disabled || !concept.trim()} className="mt-6 px-6 py-3 font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg flex items-center gap-2 shadow-lg shadow-purple-900/50 disabled:bg-slate-600 disabled:cursor-not-allowed">
            <Icon name="send" className="w-5 h-5"/>
            Generate World
        </button>
    </div>
);

const LoadingScreen: React.FC<{ status: 'GENERATING' | 'AI_REFINING' }> = ({ status }) => (
     <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
        <Icon name="sparkles" className="w-12 h-12 text-purple-400 mb-4 animate-spin" />
        <h2 className="text-2xl font-bold font-display text-slate-100">
            {status === 'GENERATING' ? 'Building Your World...' : 'Refining Your World...'}
        </h2>
        <p className="mt-2 text-slate-400 max-w-lg">The AI is weaving together characters, locations, and lore. This might take a moment.</p>
    </div>
);

const AIWorldEditor: React.FC<AIWorldEditorProps> = ({ world: initialWorld, onSave, onClose }) => {
  const { settings } = useSettingsStore();
  const [world, setWorld] = useState<Partial<World>>({ name: 'New AI World', description: '', entries: [], tags: []});
  const [editorState, setEditorState] = useState<EditorState>('CONCEPT');
  const [concept, setConcept] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refinementInput, setRefinementInput] = useState('');
  const [refinementHistory, setRefinementHistory] = useState<string[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialWorld) {
      setWorld(initialWorld);
      setEditorState('REFINING');
      if (initialWorld.entries && initialWorld.entries.length > 0) {
        setActiveEntryId(initialWorld.entries[0].id);
      }
    } else {
      // Reset state for creation mode if no world is passed
      setWorld({ name: 'New AI World', description: '', entries: [], tags: [] });
      setEditorState('CONCEPT');
      setActiveEntryId(null);
      setConcept('');
      setError(null);
      setRefinementHistory([]);
    }
  }, [initialWorld]);

  const handleGenerate = async () => {
    if (!concept.trim()) return;
    setEditorState('GENERATING');
    setError(null);
    try {
        const { provider, apiKeys, models } = settings;
        const model = models?.[provider] || '';
        const apiKey = provider === LLMProvider.GEMINI ? process.env.API_KEY || '' : apiKeys[provider];

        if (!model || (provider !== LLMProvider.GEMINI && !apiKey)) {
            throw new Error(`API Key or model not configured for ${provider}.`);
        }
        
        const generatedWorld = await generateWorldFromConcept({ provider, apiKey, model, concept });
        const entries = (generatedWorld.entries || []).map(e => ({...e, id: crypto.randomUUID()}));
        setWorld({
            ...generatedWorld,
            id: crypto.randomUUID(),
            entries: entries,
        });
        setActiveEntryId(entries[0]?.id || null);
        setEditorState('REFINING');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred.';
        logger.error('World generation failed', err);
        setError(`Failed to generate world: ${message}`);
        setEditorState('CONCEPT');
    }
  };

  const handleRefine = useCallback(async (instructionOverride?: string) => {
    const instruction = (instructionOverride || refinementInput).trim();
    if (!instruction || !world) return;
    setEditorState('AI_REFINING');
    setError(null);
    try {
        const { provider, apiKeys, models } = settings;
        const model = models?.[provider] || '';
        const apiKey = provider === LLMProvider.GEMINI ? process.env.API_KEY || '' : apiKeys[provider];

        if (!model || (provider !== LLMProvider.GEMINI && !apiKey)) {
            throw new Error(`API Key or model not configured for ${provider}.`);
        }

        const currentWorld = world as World;
        const refinedWorld = await refineWorldWithInstruction({ provider, apiKey, model, world: currentWorld, instruction });
        
        const existingIds = new Set((currentWorld.entries || []).map(e => e.id));
        const finalEntries = (refinedWorld.entries || []).map(e => {
            return existingIds.has(e.id) ? e : {...e, id: crypto.randomUUID()};
        });

        setWorld({...refinedWorld, entries: finalEntries});
        setRefinementHistory(prev => [instruction, ...prev]);
        setRefinementInput('');

    } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred.';
        logger.error('World refinement failed', err);
        setError(`Failed to refine world: ${message}`);
    } finally {
        setEditorState('REFINING');
    }
  }, [refinementInput, world, settings]);
  
  const handleSave = () => {
    if (world.name && world.entries) {
        onSave(world as World);
    }
  };
  
  const handleAddNewEntry = () => {
    const newEntry: WorldEntry = {
        id: crypto.randomUUID(),
        name: 'New Entry',
        keys: [],
        content: '',
        enabled: true,
    };
    setWorld(w => ({ ...w, entries: [...(w.entries || []), newEntry] }));
    setActiveEntryId(newEntry.id);
  };

  const handleDeleteEntry = (id: string) => {
    setWorld(w => {
        const newEntries = (w.entries || []).filter(e => e.id !== id);
        if (activeEntryId === id) {
            setActiveEntryId(newEntries[0]?.id || null);
        }
        return { ...w, entries: newEntries };
    });
  };
  
  const handleEntryChange = <K extends keyof WorldEntry>(id: string, field: K, value: WorldEntry[K]) => {
      setWorld(w => ({
          ...w,
          entries: (w.entries || []).map(entry => entry.id === id ? { ...entry, [field]: value } : entry),
      }));
  };

  const activeEntry = world.entries?.find(e => e.id === activeEntryId);

  const handleRefineWithPreset = useCallback((preset: 'expand' | 'keywords' | 'rewrite_dramatic') => {
    if (!activeEntry) return;
    let instruction = '';
    switch (preset) {
        case 'expand': instruction = `Expand on the entry named "${activeEntry.name}". Add more details about its background and connections to the world.`; break;
        case 'keywords': instruction = `Suggest 5-7 relevant keywords for the entry named "${activeEntry.name}" based on its content. Add these new keywords to the existing 'keys' array for this entry.`; break;
        case 'rewrite_dramatic': instruction = `Rewrite the content of the entry named "${activeEntry.name}" in a more dramatic and evocative tone.`; break;
    }
    handleRefine(instruction);
  }, [activeEntry, handleRefine]);

  const handleAddKeywords = useCallback(() => {
    const inputEl = keyInputRef.current;
    if (!inputEl || !inputEl.value.trim() || !activeEntry) return;

    const newKeywords = inputEl.value.split(',')
        .map(k => k.trim())
        .filter(Boolean);
    
    if (newKeywords.length > 0) {
        const currentKeys = new Set((activeEntry.keys || []).map(k => k.toLowerCase()));
        const uniqueNewKeywords = newKeywords.filter(k => !currentKeys.has(k.toLowerCase()));
        if (uniqueNewKeywords.length > 0) {
            handleEntryChange(activeEntry.id, 'keys', [...(activeEntry.keys || []), ...uniqueNewKeywords]);
        }
    }
    inputEl.value = '';
  }, [activeEntry, handleEntryChange]);

  const handleRemoveKeyword = useCallback((keyToRemove: string) => {
      if (!activeEntry) return;
      handleEntryChange(activeEntry.id, 'keys', (activeEntry.keys || []).filter(k => k !== keyToRemove));
  }, [activeEntry, handleEntryChange]);

  const handleKeyInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        handleAddKeywords();
    }
    if (e.key === 'Backspace' && keyInputRef.current?.value === '' && activeEntry?.keys && activeEntry.keys.length > 0) {
        handleRemoveKeyword(activeEntry.keys[activeEntry.keys.length - 1]);
    }
  }, [handleAddKeywords, handleRemoveKeyword, activeEntry]);

  const duplicateKeywordMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!world.entries || !activeEntryId) return map;

    for (const entry of world.entries) {
        if (entry.id === activeEntryId) continue;
        for (const key of entry.keys || []) {
            const lowerKey = key.toLowerCase();
            if (!map.has(lowerKey)) map.set(lowerKey, []);
            map.get(lowerKey)!.push(entry.name || 'Unnamed');
        }
    }
    return map;
  }, [world.entries, activeEntryId]);

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-world-editor-title"
        className={`bg-slate-900 rounded-lg shadow-2xl w-full ${editorState === 'CONCEPT' ? 'max-w-4xl' : 'max-w-7xl'} max-h-[90vh] flex flex-col border border-slate-700 transition-[max-width] duration-500 ease-in-out`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <h2 id="ai-world-editor-title" className="text-xl font-bold font-display tracking-widest uppercase flex items-center gap-3">
            <Icon name="sparkles" className="text-purple-400"/>
            AI World Editor
          </h2>
          <div>
            <button onClick={onClose} aria-label="Cancel" className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 border border-slate-600 hover:bg-slate-700 rounded-lg transition-colors">
                Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={editorState !== 'REFINING'}
              className="ml-3 px-4 py-2 text-sm font-semibold text-white bg-crimson-600 hover:bg-crimson-500 rounded-lg transition-colors border border-crimson-400/50 shadow-md shadow-crimson-900/50 disabled:bg-slate-700 disabled:cursor-not-allowed"
            >
              Save World
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-hidden relative">
            {editorState === 'CONCEPT' && <ConceptScreen concept={concept} setConcept={setConcept} handleGenerate={handleGenerate} error={error} disabled={editorState === 'GENERATING'} />}
            {(editorState === 'GENERATING' || editorState === 'AI_REFINING') && <LoadingScreen status={editorState} />}
            
            {editorState !== 'CONCEPT' && (
                 <div className="grid grid-cols-[300px_1fr_350px] h-full overflow-hidden">
                    {/* Left Panel: Entry List */}
                    <div className="flex flex-col border-r border-slate-800 bg-slate-900/50">
                        <div className="p-3 border-b border-slate-800">
                            <input type="text" value={world.name || ''} onChange={e => setWorld(w => ({...w, name: e.target.value}))} className="w-full bg-transparent text-lg font-bold p-1 focus:ring-1 focus:ring-purple-500 rounded-md" />
                            <p className="text-xs text-slate-400 mt-1">{world.entries?.length || 0} entries</p>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {(world.entries || []).map(entry => (
                                <button key={entry.id} onClick={() => setActiveEntryId(entry.id)} className={`w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors ${activeEntryId === entry.id ? 'bg-purple-600/20 text-purple-200' : 'hover:bg-slate-800 text-slate-300'}`}>
                                    <Icon name={categoryIcons[entry.category || WorldEntryCategory.LORE] || 'book-open'} className="w-4 h-4 shrink-0" />
                                    <span className="flex-1 truncate text-sm font-medium">{entry.name || 'Unnamed Entry'}</span>
                                </button>
                            ))}
                        </div>
                        <div className="p-2 border-t border-slate-800">
                            <button onClick={handleAddNewEntry} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-purple-300 bg-purple-900/50 border border-purple-700/70 rounded-lg hover:bg-purple-800/50 transition-colors">
                                <Icon name="add" className="w-4 h-4"/> New Entry
                            </button>
                        </div>
                    </div>

                    {/* Center Panel: Editor */}
                    <div className="flex flex-col bg-slate-950">
                        {activeEntry ? (
                            <>
                                <div className="p-3 border-b border-slate-800 flex items-center gap-4">
                                    <select value={activeEntry.category || ''} onChange={e => handleEntryChange(activeEntry.id, 'category', e.target.value as WorldEntryCategory)} className="bg-slate-800 border border-slate-700 rounded-md p-1 text-xs">
                                        <option value="">No Category</option>
                                        {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <input value={activeEntry.name || ''} onChange={e => handleEntryChange(activeEntry.id, 'name', e.target.value)} className="w-full bg-transparent text-lg font-bold p-1 focus:ring-1 focus:ring-purple-500 rounded-md" />
                                    <button onClick={() => handleDeleteEntry(activeEntry.id)} className="p-2 text-slate-500 hover:text-ember-400"><Icon name="delete" /></button>
                                </div>
                                <textarea value={activeEntry.content || ''} onChange={e => handleEntryChange(activeEntry.id, 'content', e.target.value)} className="w-full flex-1 bg-transparent p-4 text-sm leading-loose resize-none focus:outline-none custom-scrollbar" placeholder="Entry content..." />
                                <div className="p-4 border-t border-slate-800">
                                    <label className="text-xs font-semibold uppercase text-slate-400">Keywords</label>
                                    <p className="text-xs text-slate-500 mt-1 mb-2">Keywords trigger this entry during chat. Press Enter or comma to add.</p>
                                    <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-800/50 border-2 border-slate-700 rounded-lg focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500">
                                        {(activeEntry.keys || []).map(key => {
                                            const conflicts = duplicateKeywordMap.get(key.toLowerCase());
                                            const tagContent = (
                                                <>
                                                    {conflicts && <Icon name="alert-triangle" className="w-3.5 h-3.5 text-ember-400" />}
                                                    <span className="truncate">{key}</span>
                                                    <button type="button" onClick={() => handleRemoveKeyword(key)} className="ml-1 p-0.5 rounded-full hover:bg-purple-700">
                                                        <Icon name="close" className="w-3 h-3"/>
                                                    </button>
                                                </>
                                            );
                                            const tagClasses = `flex items-center gap-1.5 pl-2 pr-1 py-0.5 text-sm text-purple-200 bg-purple-900/70 rounded-md transition-all`;
                                            const conflictClasses = conflicts ? 'ring-2 ring-ember-500' : '';

                                            return conflicts ? (
                                                <Tooltip key={key} content={`Also in: ${conflicts.join(', ')}`} position="top">
                                                    <div className={`${tagClasses} ${conflictClasses}`}>{tagContent}</div>
                                                </Tooltip>
                                            ) : (
                                                <div key={key} className={tagClasses}>{tagContent}</div>
                                            );
                                        })}
                                        <input
                                            ref={keyInputRef}
                                            type="text"
                                            onKeyDown={handleKeyInputKeyDown}
                                            className="flex-grow bg-transparent outline-none text-sm p-1 placeholder:text-slate-500 min-w-[120px]"
                                            placeholder="Add keywords..."
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-600"><p>Select an entry to edit</p></div>
                        )}
                    </div>
              
                    {/* Right Panel: AI Assistant */}
                    <div className="flex flex-col border-l border-slate-800 bg-slate-900/50">
                        <div className="p-3 border-b border-slate-800">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-purple-300 flex items-center gap-2"><Icon name="brain" /> AI Assistant</h3>
                        </div>
                        <div className="p-3 space-y-3">
                            <h4 className="text-xs font-semibold uppercase text-slate-400">Contextual Actions</h4>
                             <div className="grid grid-cols-2 gap-2">
                                <button disabled={!activeEntry} onClick={() => handleRefineWithPreset('expand')} className="p-2 text-xs bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2"><Icon name="zap"/>Expand</button>
                                <button disabled={!activeEntry} onClick={() => handleRefineWithPreset('keywords')} className="p-2 text-xs bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2"><Icon name="send"/>Suggest Keywords</button>
                                <button disabled={!activeEntry} onClick={() => handleRefineWithPreset('rewrite_dramatic')} className="p-2 text-xs bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2 col-span-2"><Icon name="edit"/>Rewrite (Dramatic)</button>
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-xs font-semibold uppercase text-slate-400">History</h4>
                                    {refinementHistory.length > 0 && (
                                        <button onClick={() => setRefinementHistory([])} className="text-xs text-slate-500 hover:text-ember-400 hover:underline">
                                            Clear History
                                        </button>
                                    )}
                                </div>
                                {refinementHistory.map((item, index) => (
                                    <p key={index} className="text-xs text-slate-400 bg-slate-800/50 p-2 rounded-md">
                                        <span className="text-purple-400 font-bold">&gt;</span> {item}
                                    </p>
                                ))}
                                {refinementHistory.length === 0 && <p className="text-xs text-slate-500 italic text-center py-4">No refinements yet.</p>}
                            </div>
                            <div className="p-3 border-t border-slate-800">
                                {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
                                <div className="relative">
                                    <input type="text" value={refinementInput} onChange={e => setRefinementInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRefine()} placeholder="Refine with AI..." className="w-full bg-slate-950 border-2 border-slate-700 rounded-lg p-3 pr-12 focus:ring-purple-500 focus:border-purple-500" disabled={editorState === 'AI_REFINING'} />
                                    <button onClick={() => handleRefine()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 text-white rounded-md hover:bg-purple-500" disabled={editorState === 'AI_REFINING'}>
                                        <Icon name="send" className="w-5 h-5"/>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AIWorldEditor;