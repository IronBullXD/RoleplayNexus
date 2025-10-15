export enum LLMProvider {
  GEMINI = 'Gemini',
  OPENROUTER = 'OpenRouter',
  DEEPSEEK = 'DeepSeek',
}

export interface Persona {
  id: string;
  name: string;
  avatar: string;
  description: string;
}

export interface Character {
  id: string;
  name: string;
  avatar: string;
  greeting: string;
  description: string;
  persona: string;
  isImmutable?: boolean;
}

export interface StructuredPersona {
  appearance: string;
  personality: string;
  speakingStyle: string;
  background: string;
  motivations: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  characterId?: string; // For group chats
}

export enum WorldEntryCategory {
  WORLD = 'World',
  CHARACTER = 'Character',
  LOCATION = 'Location',
  ITEM = 'Item',
  FACTION = 'Faction',
  LORE = 'Lore/History',
  EVENT = 'Event',
}

export interface WorldEntry {
  id: string;
  name?: string; // The display name for the entry, used for sorting.
  keys: string[]; // Keywords to trigger this entry.
  content: string;
  enabled: boolean;
  category?: WorldEntryCategory;
  isAlwaysActive?: boolean;
}

export interface World {
  id:string;
  name: string;
  avatar?: string;
  description: string;
  entries: WorldEntry[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  worldId?: string | null;
  temperature?: number;
  contextSize?: number;
  maxOutputTokens?: number;
  memorySummary?: string;
  memoryEnabled?: boolean;
}

export interface GroupChatSession {
  id: string;
  title: string;
  characterIds: string[];
  scenario: string;
  messages: Message[];
  worldId?: string | null;
  temperature?: number;
  contextSize?: number;
  maxOutputTokens?: number;
  memorySummary?: string;
  memoryEnabled?: boolean;
}

export interface Settings {
  provider: LLMProvider;
  apiKeys: {
    [key in LLMProvider]: string;
  };
  models?: {
    [key in LLMProvider]?: string;
  };
  systemPrompt: string;
  responsePrefill: string;
  contextSize: number;
  maxOutputTokens: number;
  temperature: number;
  worldId: string | null;
}

export type View =
  | 'CHARACTER_SELECTION'
  | 'CHAT'
  | 'GROUP_CHAT_SETUP'
  | 'GROUP_CHAT';

export interface GroupTurnAction {
  characterName: string;
  content: string;
}

export interface ValidationIssue {
  type: 'DuplicateKeyword' | 'UnusedEntry' | 'MissingName' | 'ShortContent' | 'OverlappingKeyword' | 'Contradiction';
  severity: 'warning' | 'info' | 'error';
  message: string;
  entryIds: string[];
  // e.g., the duplicate keyword itself, or the overlapping keywords
  relatedData?: { keyword?: string, otherKeyword?: string, otherEntryNames?: string[] };
}

export interface ThemeConfig {
  primary: string; // hex color for the main accent (e.g., crimson)
  secondary: string; // hex color for the secondary accent (e.g., ember)
  neutral: string; // hex color for the base dark background (e.g., a dark slate)
  text: string; // hex color for primary text
}

export interface Theme {
  id: string;
  name: string;
  isImmutable?: boolean;
  config: ThemeConfig;
}
