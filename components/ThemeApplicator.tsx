import { useEffect } from 'react';
import { useSettingsStore } from '../store/stores/settingsStore';
import { applyTheme } from '../services/themeService';

const ThemeApplicator = () => {
    const themes = useSettingsStore(state => state.themes);
    const activeThemeId = useSettingsStore(state => state.activeThemeId);
    
    useEffect(() => {
        const activeTheme = themes.find(t => t.id === activeThemeId) || themes.find(t => t.id === 'cyber-noir');
        applyTheme(activeTheme || null);
    }, [activeThemeId, themes]);

    return null; // This component does not render anything
};

export default ThemeApplicator;
