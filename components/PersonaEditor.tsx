import React, { useState, useEffect, useRef } from 'react';
import { Persona } from '../types';
import { Icon } from './Icon';
import Avatar from './Avatar';
import { useAppContext } from '../contexts/AppContext';

interface PersonaEditorProps {
  persona: Persona;
  onClose: () => void;
}

const PersonaEditor: React.FC<PersonaEditorProps> = ({ persona, onClose }) => {
  const { savePersona } = useAppContext();
  const [formData, setFormData] = useState<Persona>(persona);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setFormData(persona); }, [persona]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(p => ({ ...p, avatar: reader.result as string }));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    savePersona(formData);
    onClose();
  };
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-700 animate-slide-up" onClick={e => e.stopPropagation()}>
        <header className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold font-display tracking-widest uppercase">Edit Your Persona</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md"><Icon name="close" /></button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                <div className="flex items-center space-x-6">
                    <div className="relative group shrink-0">
                        <Avatar src={formData.avatar} alt="avatar" shape="square" className="w-32 h-32 border-2 border-slate-700" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Change avatar"><Icon name="edit" className="w-6 h-6 text-white" /></button>
                    </div>
                    <div className="flex-1">
                        <label htmlFor="name" className="block text-sm font-medium text-slate-300">Your Name</label>
                        <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-lg p-3 placeholder:text-slate-600" required />
                        <div className="flex items-center gap-4 mt-2">
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm text-sky-400 hover:underline">Upload Image</button>
                            {formData.avatar && <button type="button" onClick={() => setFormData(p => ({ ...p, avatar: '' }))} className="text-sm text-fuchsia-500 hover:underline">Remove Image</button>}
                        </div>
                    </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp, image/gif" />
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-slate-300">Your Persona Description</label>
                     <p className="text-xs text-slate-400 mt-1 mb-2">This tells the AI who you are roleplaying as. Describe your character, personality, and how you want the AI to see you.</p>
                    <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={6} className="block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm p-3 placeholder:text-slate-600 custom-scrollbar" placeholder="e.g., A witty space pirate with a heart of gold, searching for ancient relics. Speaks casually with a bit of swagger." />
                </div>
            </div>
            <footer className="p-4 border-t border-slate-800 flex justify-end space-x-3 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 border border-slate-600 hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors border border-sky-400/50 shadow-md shadow-sky-900/50">Save Persona</button>
            </footer>
        </form>
      </div>
    </div>
  );
};

export default PersonaEditor;
