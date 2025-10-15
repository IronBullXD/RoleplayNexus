import React, { useState, useEffect } from 'react';
import { Theme, ThemeConfig } from '../types';
import { Icon } from './Icon';
import { useSettingsStore } from '../store/stores/settingsStore';
import { motion } from 'framer-motion';
import { applyTheme } from '../services/themeService';

interface ThemeEditorModalProps {
  theme: Theme | null;
  onClose: () => void;
}

const ColorInput: React.FC<{
    label: string;
    value: string;
    onChange: (color: string) => void;
}> = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        <div className="flex items-center gap-2 p-1 border border-slate-700 bg-slate-950 rounded-md">
            <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-8 h-8 border-none bg-transparent cursor-pointer"
                style={{'WebkitAppearance': 'none', 'MozAppearance': 'none', appearance: 'none'}}
            />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-24 bg-transparent text-sm font-mono focus:ring-0 border-0"
                pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
            />
        </div>
    </div>
);

const ThemeEditorModal: React.FC<ThemeEditorModalProps> = ({ theme, onClose }) => {
    const { saveTheme, themes, activeThemeId } = useSettingsStore();
    const [name, setName] = useState('');
    const [config, setConfig] = useState<ThemeConfig>({
        primary: '#ef4444',
        secondary: '#f97316',
        neutral: '#0A0B0F',
        text: '#F1F2F5',
    });
    
    const originalTheme = themes.find(t => t.id === activeThemeId);

    useEffect(() => {
        if (theme) {
            setName(theme.name);
            setConfig(theme.config);
        } else {
            setName('My Custom Theme');
            // Start with a copy of the current theme's colors
            const currentTheme = themes.find(t => t.id === activeThemeId);
            if(currentTheme) setConfig(currentTheme.config);
        }
    }, [theme, themes, activeThemeId]);

    // Live preview effect
    useEffect(() => {
        const previewTheme: Theme = {
            id: 'preview',
            name: 'Preview',
            config,
        };
        applyTheme(previewTheme);
        
        // On cleanup, re-apply the original theme
        return () => {
             applyTheme(originalTheme || null);
        }
    }, [config, originalTheme]);


    const handleSave = () => {
        if (!name.trim()) return;

        const themeToSave: Theme = {
            id: theme?.id || crypto.randomUUID(),
            name: name.trim(),
            config,
            isImmutable: false,
        };
        saveTheme(themeToSave);
        onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[60] backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-md flex flex-col border border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold font-display tracking-widest uppercase">
                        {theme ? 'Edit Theme' : 'Create Theme'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md">
                        <Icon name="close" />
                    </button>
                </header>

                <main className="p-6 space-y-4">
                    <div>
                        <label htmlFor="theme-name" className="block text-sm font-medium text-slate-300">Theme Name</label>
                        <input
                            type="text"
                            id="theme-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-crimson-500 focus:border-crimson-500 sm:text-sm p-3"
                        />
                    </div>
                    <p className="text-xs text-slate-500">Changes are previewed live. The app will generate a full color palette from these base colors.</p>
                    <div className="space-y-3 p-4 bg-slate-800/50 rounded-lg">
                        <ColorInput label="Primary Accent" value={config.primary} onChange={c => setConfig(p => ({...p, primary: c}))} />
                        <ColorInput label="Secondary Accent" value={config.secondary} onChange={c => setConfig(p => ({...p, secondary: c}))} />
                        <ColorInput label="Dark Background" value={config.neutral} onChange={c => setConfig(p => ({...p, neutral: c}))} />
                        <ColorInput label="Main Text" value={config.text} onChange={c => setConfig(p => ({...p, text: c}))} />
                    </div>
                </main>

                <footer className="p-4 border-t border-slate-800 flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 border border-slate-600 hover:bg-slate-700 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button type="button" onClick={handleSave} className="px-4 py-2 text-sm font-semibold text-white bg-crimson-600 hover:bg-crimson-500 rounded-lg transition-colors border border-crimson-400/50 shadow-md shadow-crimson-900/50">
                        Save Theme
                    </button>
                </footer>

            </motion.div>
        </motion.div>
    );
};

export default ThemeEditorModal;
