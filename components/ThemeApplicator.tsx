import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { applyTheme } from '../services/themeService';

const ThemeApplicator = () => {
    const themes = useAppStore(state => state.themes);
    const activeThemeId = useAppStore(state => state.activeThemeId);
    
    useEffect(() => {
        const activeTheme = themes.find(t => t.id === activeThemeId) || themes.find(t => t.id === 'cyber-noir');
        applyTheme(activeTheme || null);
    }, [activeThemeId, themes]);

    return null; // This component does not render anything
};

export default ThemeApplicator;
