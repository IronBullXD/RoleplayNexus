import { Settings, Persona } from '../../types';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { DEFAULT_SETTINGS, DEFAULT_USER_PERSONA } from '../../constants';

export const useSettingsLogic = () => {
  const [settings, setSettings] = useLocalStorage<Settings>('settings', DEFAULT_SETTINGS);
  const [userPersona, setUserPersona] = useLocalStorage<Persona>('userPersona', DEFAULT_USER_PERSONA);

  const saveSettings = (newSettings: Settings) => setSettings(newSettings);
  const savePersona = (persona: Persona) => setUserPersona(persona);

  return {
    settings,
    setSettings,
    userPersona,
    setUserPersona,
    saveSettings,
    savePersona,
  };
};
