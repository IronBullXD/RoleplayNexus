import React, { useState, useEffect, useRef } from 'react';
import { Character, StructuredPersona } from '../types';
import { Icon } from './Icon';
import Avatar from './Avatar';
import { useAppStore } from '../store/useAppStore';

interface CharacterEditorProps {
  character: Character | null;
  onClose: () => void;
}

const personaHeaders: { [key in keyof StructuredPersona]: string } = {
  appearance: "Appearance:", personality: "Personality:", speakingStyle: "Speaking style:", background: "Background:", motivations: "Motivations:",
};
const initialStructuredPersona: StructuredPersona = { appearance: '', personality: '', speakingStyle: '', background: '', motivations: '' };

const parsePersona = (personaText: string): StructuredPersona => {
  const result: StructuredPersona = { ...initialStructuredPersona };
  if (!personaText) return result;
  const headers = Object.values(personaHeaders);
  const regex = new RegExp(`(${headers.join('|')})`, 'g');
  const parts = personaText.split(regex).slice(1);
  if (parts.length === 0) { result.personality = personaText; return result; }
  for (let i = 0; i < parts.length; i += 2) {
    const header = parts[i];
    const content = parts[i + 1] ? parts[i + 1].trim() : '';
    const key = (Object.keys(personaHeaders) as Array<keyof StructuredPersona>).find(k => personaHeaders[k] === header);
    if (key) result[key] = content;
  }
  return result;
};

const serializePersona = (structured: StructuredPersona): string => (
  (Object.keys(personaHeaders) as Array<keyof StructuredPersona>)
    .map(key => structured[key]?.trim() ? `${personaHeaders[key]}\n${structured[key].trim()}` : '')
    .filter(Boolean).join('\n\n')
);

const CharacterEditor: React.FC<CharacterEditorProps> = ({ character, onClose }) => {
  const { saveCharacter, generateCharacterProfile } = useAppStore();
  const [formData, setFormData] = useState<Partial<Character>>({ name: '', avatar: '', greeting: '', description: '', persona: '' });
  const [structuredPersona, setStructuredPersona] = useState<StructuredPersona>(initialStructuredPersona);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAIAssistOpen, setIsAIAssistOpen] = useState(false);
  const [aiConcept, setAiConcept] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    setFormData(character || { name: '', avatar: '', greeting: '', description: '', persona: '' });
  }, [character]);
  
  useEffect(() => { setStructuredPersona(parsePersona(formData.persona || '')); }, [formData.persona]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleStructuredPersonaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setStructuredPersona(p => ({ ...p, [e.target.name as keyof StructuredPersona]: e.target.value }));
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(p => ({ ...p, avatar: reader.result as string }));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveCharacter({ ...formData, id: formData.id || crypto.randomUUID(), persona: serializePersona(structuredPersona) } as Character);
    onClose();
  };
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleGenerateClick = async () => {
    if (!aiConcept.trim()) return;
    setIsGenerating(true); setGenerationError(null);
    try {
      const generatedProfile = await generateCharacterProfile(aiConcept);
      setFormData(prev => ({ ...prev, ...generatedProfile, id: prev.id, avatar: prev.avatar }));
      setIsAIAssistOpen(false); setAiConcept('');
    } catch (err) {
      setGenerationError(`Generation failed: ${err instanceof Error ? err.message : 'An unknown error occurred.'}`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const PersonaField: React.FC<{ name: keyof StructuredPersona; label: string; placeholder: string; rows?: number; }> = ({ name, label, placeholder, rows = 3 }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-slate-300 tracking-wider">{label}</label>
        <textarea name={name} id={name} value={structuredPersona[name]} onChange={handleStructuredPersonaChange} rows={rows} className="mt-1 block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm p-3 placeholder:text-slate-600 custom-scrollbar" placeholder={placeholder} />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-700 animate-slide-up" onClick={e => e.stopPropagation()}>
        <header className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold font-display tracking-widest uppercase">{character ? 'Edit Character' : 'Create Character'}</h2>
              <button type="button" onClick={() => setIsAIAssistOpen(!isAIAssistOpen)} className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-sky-300 bg-sky-900/50 border border-sky-700/70 rounded-md hover:bg-sky-800/50 transition-colors shadow-inner shadow-sky-900/50"><Icon name="sparkles" className="w-3.5 h-3.5" /> AI ASSIST</button>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md"><Icon name="close" /></button>
        </header>
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {isAIAssistOpen && (
                    <div className="p-4 mb-6 bg-slate-800/50 rounded-lg border-l-4 border-sky-500 animate-fade-in space-y-3 shadow-lg shadow-sky-900/20">
                        <label htmlFor="ai-concept" className="block text-sm font-medium text-slate-200 font-display tracking-wider">CHARACTER CONCEPT</label>
                        <p className="text-xs text-slate-400">Describe your character idea, and the AI will generate a profile.</p>
                        <div className="flex items-center gap-2">
                            <input type="text" id="ai-concept" value={aiConcept} onChange={(e) => setAiConcept(e.target.value)} className="block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm p-2 placeholder:text-slate-600" disabled={isGenerating} />
                            <button type="button" onClick={handleGenerateClick} disabled={isGenerating || !aiConcept.trim()} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors disabled:bg-slate-600 disabled:cursor-wait flex items-center gap-2 shrink-0 border border-sky-400/50 shadow-md shadow-sky-900/50"><Icon name={isGenerating ? 'redo' : 'sparkles'} className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />{isGenerating ? 'Generating...' : 'Generate'}</button>
                        </div>
                        {generationError && <p className="text-xs text-red-400 mt-2">{generationError}</p>}
                    </div>
                )}
                <div className="space-y-6">
                    <div className="flex items-center space-x-6">
                        <div className="relative group shrink-0"><Avatar src={formData.avatar} alt="avatar" className="w-24 h-24 border-2 border-slate-700" /><button type="button" onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Change avatar"><Icon name="edit" className="w-6 h-6 text-white" /></button></div>
                        <div className="flex-1">
                            <label htmlFor="name" className="block text-sm font-medium text-slate-300">Character Name</label>
                            <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-lg p-3 placeholder:text-slate-600" required pattern=".*\S+.*" title="The character name cannot be empty or just spaces." />
                            <div className="flex items-center gap-4 mt-2">
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm text-sky-400 hover:underline">Upload Image</button>
                                {formData.avatar && <button type="button" onClick={() => setFormData(p => ({ ...p, avatar: '' }))} className="text-sm text-fuchsia-500 hover:underline">Remove Image</button>}
                            </div>
                        </div>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp, image/gif" />
                    <div><label htmlFor="greeting" className="block text-sm font-medium text-slate-300">Greeting Message</label><textarea name="greeting" id="greeting" value={formData.greeting} onChange={handleChange} rows={2} className="mt-1 block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm p-3 placeholder:text-slate-600 custom-scrollbar" placeholder="The first message your character will send."/></div>
                    <div><label htmlFor="description" className="block text-sm font-medium text-slate-300">Short Description</label><textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={2} className="mt-1 block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm p-3 placeholder:text-slate-600 custom-scrollbar" placeholder="A brief summary shown in the character list."/></div>
                    <div><label className="block text-sm font-medium text-slate-300 font-display tracking-wider">PERSONA</label><p className="text-xs text-slate-400 mt-1 mb-2">Describe the character's core identity. These fields create the final prompt for the AI.</p><div className="space-y-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50"><PersonaField name="appearance" label="Appearance" placeholder="Physical description, clothing, etc." /><PersonaField name="personality" label="Personality" placeholder="Key traits, behaviors, and mannerisms." /><PersonaField name="speakingStyle" label="Speaking Style" placeholder="Voice, accent, vocabulary, etc." /><PersonaField name="background" label="Background" placeholder="A brief history of the character." /><PersonaField name="motivations" label="Motivations" placeholder="What drives the character's actions." /></div></div>
                </div>
            </div>
            <footer className="p-4 border-t border-slate-800 flex justify-end space-x-3 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 border border-slate-600 hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors border border-sky-400/50 shadow-md shadow-sky-900/50">Save Character</button>
            </footer>
        </form>
      </div>
    </div>
  );
};

export default CharacterEditor;