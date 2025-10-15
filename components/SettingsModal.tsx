import React, { useState, useEffect } from 'react';
import { Settings, LLMProvider } from '../types';
import { Icon } from './Icon';
import { useAppStore } from '../store/useAppStore';
import { motion } from 'framer-motion';

interface SettingsModalProps {
  onClose: () => void;
}

type SettingsSection = 'general' | 'providers' | 'prompts';

function SectionButton({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 text-left px-3 py-2 text-sm font-medium rounded-md transition-colors relative ${
        isActive
          ? 'bg-crimson-600/20 text-crimson-300'
          : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
      }`}
    >
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-crimson-400 rounded-r-full"></div>
      )}
      <Icon name={icon} className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );
}

// FIX: Changed component from a function declaration to a const with React.FC to resolve typing issues with the `children` prop.
const SettingsSectionPanel: React.FC<{
  title: string;
  description: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-xl font-bold text-slate-100 font-display tracking-wider uppercase">
          {title}
        </h3>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
      </div>
      <div className="space-y-6 border-t border-slate-700 pt-6">{children}</div>
    </div>
  );
};

// FIX: Changed component from a function declaration to a const with React.FC to resolve typing issues with the `children` prop.
const FormField: React.FC<{
  label: string;
  description?: string;
  htmlFor: string;
  children: React.ReactNode;
}> = ({ label, description, htmlFor, children }) => {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-300"
      >
        {label}
      </label>
      {description && (
        <p className="text-xs text-slate-500 mt-1 mb-2">{description}</p>
      )}
      {children}
    </div>
  );
};

function GeneralSection({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}) {
  return (
    <SettingsSectionPanel
      title="General"
      description="Configure the default behavior of the application."
    >
      <FormField
        label="Default LLM Provider"
        htmlFor="provider-toggle"
        description="Select which provider to use for all chat completions."
      >
        <div
          id="provider-toggle"
          className="grid grid-cols-3 gap-2 p-1 bg-slate-800 rounded-lg"
        >
          {Object.values(LLMProvider).map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setSettings((prev) => ({ ...prev, provider: p }))}
              className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                settings.provider === p
                  ? 'bg-crimson-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </FormField>
    </SettingsSectionPanel>
  );
}

interface ProviderConfigProps {
  provider: LLMProvider;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const ProviderConfig: React.FC<ProviderConfigProps> = ({
  provider,
  settings,
  setSettings,
}) => {
  const isGemini = provider === LLMProvider.GEMINI;
  const info = {
    [LLMProvider.GEMINI]: {
      description:
        'Powered by Google. The API key is pre-configured and managed by the environment.',
      keyLink: 'https://aistudio.google.com/app/apikey',
    },
    [LLMProvider.OPENROUTER]: {
      description:
        'Access a wide variety of models from different providers through a single API.',
      keyLink: 'https://openrouter.ai/keys',
    },
    [LLMProvider.DEEPSEEK]: {
      description: 'A specialized model provider focused on code and chat.',
      keyLink: 'https://platform.deepseek.com/api_keys',
    },
  }[provider];

  return (
    <details
      className="p-4 border border-slate-700 bg-slate-800/50 rounded-lg group"
      open
    >
      <summary className="text-md font-semibold text-slate-200 cursor-pointer list-none flex justify-between items-center font-display tracking-wider">
        {provider}
        <Icon
          name="add"
          className="w-5 h-5 text-slate-400 group-open:rotate-45 transition-transform"
        />
      </summary>
      <div className="mt-4 space-y-4 border-t border-slate-700/50 pt-4">
        <p className="text-sm text-slate-400">
          {info.description}{' '}
          {!isGemini && (
            <a
              href={info.keyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-crimson-400 hover:underline"
            >
              {' '}
              Get your key here.
            </a>
          )}
        </p>
        {!isGemini && (
          <FormField label="API Key" htmlFor={`${provider}-key`}>
            <input
              type="password"
              id={`${provider}-key`}
              value={settings.apiKeys[provider]}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  apiKeys: { ...p.apiKeys, [provider]: e.target.value },
                }))
              }
              className="block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-crimson-500 focus:border-crimson-500 sm:text-sm p-3 placeholder:text-slate-600"
              placeholder="Enter your API key"
            />
          </FormField>
        )}
        <FormField label="Model Name" htmlFor={`${provider}-model`}>
          <input
            type="text"
            id={`${provider}-model`}
            value={settings.models?.[provider] || ''}
            onChange={(e) =>
              setSettings((p) => ({
                ...p,
                models: { ...p.models, [provider]: e.target.value },
              }))
            }
            className="block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-crimson-500 focus:border-crimson-500 sm:text-sm p-3 placeholder:text-slate-600"
            placeholder={
              isGemini
                ? 'e.g., gemini-2.5-flash'
                : 'e.g., gryphe/mythomax-l2-13b'
            }
            required
          />
        </FormField>
      </div>
    </details>
  );
};

function ProvidersSection({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}) {
  return (
    <SettingsSectionPanel
      title="Provider Configuration"
      description="Enter your API credentials for each service you wish to use."
    >
      {Object.values(LLMProvider).map((p) => (
        <ProviderConfig
          key={p}
          provider={p}
          settings={settings}
          setSettings={setSettings}
        />
      ))}
    </SettingsSectionPanel>
  );
}

function PromptsSection({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}) {
  return (
    <SettingsSectionPanel
      title="Prompts & Instructions"
      description="Customize the instructions sent to the AI for every chat."
    >
      <FormField
        label="Global System Prompt"
        htmlFor="systemPrompt"
        description="A set of general instructions sent to the AI for every chat, useful for defining formatting rules or a baseline personality."
      >
        <textarea
          id="systemPrompt"
          value={settings.systemPrompt}
          onChange={(e) =>
            setSettings((p) => ({ ...p, systemPrompt: e.target.value }))
          }
          rows={8}
          className="block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-crimson-500 focus:border-crimson-500 sm:text-sm p-3 font-mono text-xs leading-relaxed custom-scrollbar"
        />
      </FormField>
      <FormField
        label="Global Response Prefill"
        htmlFor="responsePrefill"
        description="Forces the AI's response to start with this text. Helps the AI stay in character or bypass certain filters."
      >
        <textarea
          id="responsePrefill"
          value={settings.responsePrefill}
          onChange={(e) =>
            setSettings((p) => ({ ...p, responsePrefill: e.target.value }))
          }
          rows={3}
          className="block w-full bg-slate-950 border-2 border-slate-700 rounded-lg shadow-sm focus:ring-crimson-500 focus:border-crimson-500 sm:text-sm p-3 font-mono text-xs leading-relaxed placeholder:text-slate-600 custom-scrollbar"
          placeholder='Example: "Understood. I will now reply as dramatically as possible..."'
        />
      </FormField>
    </SettingsSectionPanel>
  );
}

function SettingsModal({ onClose }: SettingsModalProps) {
  const { settings: currentSettings, saveSettings } = useAppStore();
  const [settings, setSettings] = useState<Settings>(currentSettings);
  const [activeSection, setActiveSection] =
    useState<SettingsSection>('general');

  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(settings);
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const renderSection = () => {
    switch (activeSection) {
      case 'general':
        return <GeneralSection settings={settings} setSettings={setSettings} />;
      case 'providers':
        return (
          <ProvidersSection settings={settings} setSettings={setSettings} />
        );
      case 'prompts':
        return <PromptsSection settings={settings} setSettings={setSettings} />;
      default:
        return null;
    }
  };

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
        className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-5xl flex flex-col border border-slate-700 h-[90vh] max-h-[800px]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold font-display tracking-widest uppercase">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md"
          >
            <Icon name="close" />
          </button>
        </header>
        <form
          onSubmit={handleSave}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="flex flex-1 overflow-hidden">
            <aside className="w-64 border-r border-slate-800 p-4 shrink-0 bg-slate-900/50">
              <nav className="space-y-1.5">
                <SectionButton
                  icon="sliders"
                  label="General"
                  isActive={activeSection === 'general'}
                  onClick={() => setActiveSection('general')}
                />
                <SectionButton
                  icon="send"
                  label="Providers"
                  isActive={activeSection === 'providers'}
                  onClick={() => setActiveSection('providers')}
                />
                <SectionButton
                  icon="edit"
                  label="Prompts"
                  isActive={activeSection === 'prompts'}
                  onClick={() => setActiveSection('prompts')}
                />
              </nav>
            </aside>
            <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {renderSection()}
            </main>
          </div>
          <footer className="p-4 border-t border-slate-800 flex justify-end space-x-3 shrink-0 bg-slate-900/95">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 border border-slate-600 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-crimson-600 hover:bg-crimson-500 rounded-lg transition-colors border border-crimson-400/50 shadow-md shadow-crimson-900/50"
            >
              Save Settings
            </button>
          </footer>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default SettingsModal;