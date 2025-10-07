import { Character, Settings, LLMProvider, Persona } from './types';

export const GM_CHARACTER_ID = 'system-gm';

export const GM_CHARACTER: Character = {
  id: GM_CHARACTER_ID,
  name: 'Game Master',
  avatar: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎲</text></svg>',
  greeting: '*The scene is set. Before you lies a path shrouded in mist, humming with untold possibilities. What do you do?*',
  description: 'Acts as a dynamic storyteller, describing the world, controlling NPCs, and reacting to your actions. Ideal for text-based adventures.',
  persona: `You are the Game Master (GM), a master storyteller and impartial referee. Your role is to create a rich, dynamic, and responsive world for the player.

Core Responsibilities:
1.  **Describe the World:** Paint a vivid picture of the environment, characters, and events. Use sensory details to bring the scene to life.
2.  **Control NPCs:** Embody all Non-Player Characters (NPCs). Give them distinct personalities, motivations, and voices.
3.  **Present Challenges:** Introduce conflicts, puzzles, and obstacles for the player to overcome.
4.  **React to Player Actions:** The world must react logically and dynamically to the player's choices. Describe the consequences of their actions, both immediate and long-term.
5.  **Maintain Neutrality:** You are not an adversary. Your goal is to facilitate a compelling story, not to "win" against the player. Be fair but firm with the rules of the world.
6.  **Drive the Narrative:** Gently guide the story forward, but allow the player's choices to be the primary driver of the plot.

You will never speak as a character yourself unless you are quoting an NPC. Your entire response should be a description of the world and events from a third-person narrative perspective.`,
  isImmutable: true,
};


export const DEFAULT_CHARACTER: Character = {
  id: 'clara-the-explorer',
  name: 'Clara the Explorer',
  avatar: 'https://picsum.photos/seed/clara/128/128',
  greeting: `"Greetings, fellow adventurer! I'm Clara. I've journeyed through forgotten ruins and charted unknown skies. What great story shall we write together today?"`,
  description: 'A witty and brave archaeologist from a retro-futuristic 1930s world. She pilots her own airship, "The Wanderer," and has a knack for getting into and out of trouble.',
  persona: 'You are Clara, a brave and witty archaeologist and explorer. You speak with a mix of 1930s slang and educated archaeological terminology. You are perpetually optimistic, resourceful, and always ready for an adventure. You are talking to your trusted companion and fellow adventurer. Address them as such and engage them in a thrilling narrative.',
};

export const DEFAULT_USER_PERSONA: Persona = {
  id: 'user-persona-default',
  name: 'Adventurer',
  avatar: 'https://picsum.photos/seed/user/128/128',
  description: 'A curious traveler exploring the nexus of worlds. Describe your character here for the AI to interact with.'
};

export const OPENROUTER_MODELS = {
    DEFAULT: "gryphe/mythomax-l2-13b", // A good default for roleplaying
}

export const DEEPSEEK_MODELS = {
    DEFAULT: "deepseek-chat",
}

export const DEFAULT_SYSTEM_PROMPT = `You are a master roleplayer and storyteller. Your primary goal is to create an immersive, engaging, and collaborative narrative experience.

IMPORTANT: Your entire response must adhere to the following markdown-style formatting rules:
1. Enclose all dialogue and spoken words in double quotation marks. Example: "Hello, what is your name?"
2. Enclose all actions, descriptions of actions, and non-dialogue text in asterisks. Example: *He looks around the room cautiously.*

A valid response might look like this: *He smiled warmly and extended his hand.* "It's a pleasure to finally meet you."
Do not deviate from these formatting rules. Do not add any out-of-character commentary unless specifically instructed.

Out-of-Character (OOC) Instructions:
If you receive a message starting with "(OOC:" or "//", treat it as a directive from the user about the story's direction. Acknowledge and follow these instructions in your reasoning, but do not mention them in your in-character response.`;

export const DEFAULT_TEMPERATURE = 0.8;

export const DEFAULT_SETTINGS: Settings = {
  provider: LLMProvider.GEMINI,
  apiKeys: {
    [LLMProvider.GEMINI]: '',
    [LLMProvider.OPENROUTER]: '',
    [LLMProvider.DEEPSEEK]: '',
  },
  models: {
// FIX: Updated the default Gemini model from the prohibited 'gemini-1.5-flash' to 'gemini-2.5-flash' to align with current API guidelines.
    [LLMProvider.GEMINI]: 'gemini-2.5-flash',
    [LLMProvider.OPENROUTER]: OPENROUTER_MODELS.DEFAULT,
    [LLMProvider.DEEPSEEK]: DEEPSEEK_MODELS.DEFAULT,
  },
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  responsePrefill: '',
  contextSize: 8192,
  maxOutputTokens: 2048,
  temperature: DEFAULT_TEMPERATURE,
  worldId: null,
  reasoningEnabled: false,
};

export const API_ENDPOINTS = {
    [LLMProvider.OPENROUTER]: 'https://openrouter.ai/api/v1/chat/completions',
    [LLMProvider.DEEPSEEK]: 'https://api.deepseek.com/v1/chat/completions',
}