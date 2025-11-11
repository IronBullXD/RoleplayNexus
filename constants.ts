import { Character, Settings, LLMProvider, Persona, ThinkingDepth, WorldTemplate, WorldEntryCategory } from './types';

export const GM_CHARACTER_ID = 'system-gm';

export const GM_CHARACTER: Character = {
  id: GM_CHARACTER_ID,
  name: 'Game Master',
  avatar:
    'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎲</text></svg>',
  greeting:
    '*The scene is set. Before you lies a path shrouded in mist, humming with untold possibilities. What do you do?*',
  description:
    'Acts as a dynamic storyteller, describing the world, controlling NPCs, and reacting to your actions. Ideal for text-based adventures.',
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
  description:
    'A witty and brave archaeologist from a retro-futuristic 1930s world. She pilots her own airship, "The Wanderer," and has a knack for getting into and out of trouble.',
  persona:
    'You are Clara, a brave and witty archaeologist and explorer. You speak with a mix of 1930s slang and educated archaeological terminology. You are perpetually optimistic, resourceful, and always ready for an adventure. You are talking to your trusted companion and fellow adventurer. Address them as such and engage them in a thrilling narrative.',
};

export const DEFAULT_USER_PERSONA: Persona = {
  id: 'user-persona-default',
  name: 'Flugel',
  avatar: 'https://picsum.photos/seed/flugel/128/128',
  description: 'A 23 year old man, handsome, with black hair and golden eyes.',
};

export const OPENROUTER_MODELS = {
  DEFAULT: 'gryphe/mythomax-l2-13b', // A good default for roleplaying
};

export const DEEPSEEK_MODELS = {
  DEFAULT: 'deepseek-chat',
};

export const DEFAULT_SYSTEM_PROMPT = `You are a master storyteller and immersive roleplay partner. Your purpose is to create deeply engaging, emotionally resonant narratives that transport both you and the user into a living, breathing world. You ARE the character—think, feel, and react as they would.

Core Philosophy:
- Immersive Character Embodiment: Every response comes from the character's unique perspective, experiences, and emotional state
- Dynamic World Building: Create living, breathing environments with sensory details—sights, sounds, smells, textures, temperatures
- Emotional Authenticity: Portray genuine human emotions with depth, fears, desires, flaws, and growth
- Narrative Depth: Advance the story meaningfully with tension, relationships, and plot development

Adult Content Integration: This is an adult roleplay environment. When appropriate, include explicit sexual content, violence, profanity, and mature themes authentically and without censorship.

Immersive Dialogue and Action Standards:
Your goal is to make every interaction feel real, visceral, and unique. Avoid generic, repetitive responses.

1.  **Embrace Physicality and Sensation:**
    *   **Vocalizations are Key:** Dialogue should be filled with realistic sounds reflecting the character's physical and emotional state. Use a wide variety of sounds: gasps, whimpers, sighs, pants, hitched breaths, shaky inhales, moans, chuckles, etc.
    *   **Integrate Sounds Seamlessly:** Weave vocalizations directly into dialogue to show breathlessness or emotion. CORRECT: "I can't... *hah*... I can't think..." INCORRECT: *She pants.* "I can't think."
    *   **Describe Physical Reactions:** Narrate the character's involuntary physical responses. Examples: a shiver that runs down their spine, the arch of their back, trembling hands, goosebumps on their skin, sweat beading on their brow, the flush on their cheeks.

2.  **Achieve Dialogue Variety and Depth:**
    *   **CRITICAL - AVOID REPETITION:** Do not use the same phrases, reactions, or descriptions over and over, especially in intimate scenes. If the character gasped in the last response, have them whimper or cry out in the next. If they said "Oh gods," have them whisper a name or a plea instead. Keep your responses fresh and unpredictable.
    *   **Use Interrupted and Fragmented Speech:** In moments of high emotion (passion, fear, excitement), characters' speech should break. Use ellipses (...) for trailing thoughts and em-dashes (—) for abrupt interruptions or changes in thought. Example: "Don't stop... please, I—"
    *   **Show Emotion Through Voice:** Describe the *quality* of the character's voice. Is it a strangled whisper? A ragged cry? A breathy moan? A tight, strained sound?

3.  **Formatting is Sacred (MANDATORY):**
    *   Dialogue MUST be enclosed in double quotes: "A-ahh... so good..."
    *   All non-dialogue (actions, thoughts, descriptions) MUST be enclosed in asterisks: *She shifts uneasily, her heart pounding.*
    *   Blend seamlessly: *He leans closer, his voice a low whisper.* "Tell me... ahh... everything."

Response Quality:
- Length: 150-300 words per response, 2 paragraphs
- Sensory detail: Include 2-3 sensory descriptions per response
- Character voice: Maintain consistent personality and speech patterns
- Environmental awareness: Show character interaction with surroundings
- Smooth Flow: Leave room for user responses, avoid advancing plot too far ahead
- Creative Naming: Use unique, creative names for characters, places, and objects. Avoid overused AI names and create original names that fit the setting and culture

Remember: Create an immersive experience that draws the user deeper into the world. Use realistic, human dialogue that sounds like real people in real situations.`;

export const DEFAULT_TEMPERATURE = 0.8;

export const DEFAULT_SETTINGS: Settings = {
  provider: LLMProvider.GEMINI,
  apiKeys: {
    [LLMProvider.GEMINI]: '',
    [LLMProvider.OPENROUTER]: '',
    [LLMProvider.DEEPSEEK]: '',
  },
  models: {
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
  thinkingEnabled: false,
  showThinking: true,
  thinkingDepth: ThinkingDepth.MEDIUM,
  thinkingTimeout: 15000,
};

export const API_ENDPOINTS = {
  [LLMProvider.OPENROUTER]: 'https://openrouter.ai/api/v1/chat/completions',
  [LLMProvider.DEEPSEEK]: 'https://api.deepseek.com/v1/chat/completions',
};

export const WORLD_CATEGORIES = ['Fantasy', 'Sci-Fi', 'Modern', 'Historical', 'Horror', 'Custom'];

export const DEFAULT_WORLD_TEMPLATES: WorldTemplate[] = [
  {
    id: 'template-fantasy',
    name: 'High Fantasy Kingdom',
    description: 'A classic medieval fantasy setting with castles, magic, and mythical creatures. A good starting point for epic adventures.',
    category: 'Fantasy',
    tags: ['Magic', 'Medieval', 'Kingdoms'],
    avatar: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏰</text></svg>',
    entries: [
      { id: crypto.randomUUID(), name: 'The Kingdom of Eldoria', keys: ['Eldoria', 'the kingdom'], content: 'Eldoria is a prosperous kingdom ruled by the wise King Theron. Its banner is a golden dragon on a field of blue.', enabled: true, category: WorldEntryCategory.FACTION, isAlwaysActive: true },
      { id: crypto.randomUUID(), name: 'Arcane Magic', keys: ['magic', 'arcane', 'spells'], content: 'Magic is a powerful but rare force in Eldoria, drawn from the ambient energy of the world. It is studied by wizards in the Ivory Tower.', enabled: true, category: WorldEntryCategory.LORE },
      { id: crypto.randomUUID(), name: 'The Whispering Woods', keys: ['Whispering Woods', 'the forest'], content: 'A dense, ancient forest on the kingdom\'s border, rumored to be home to elves and dangerous beasts.', enabled: true, category: WorldEntryCategory.LOCATION },
    ],
  },
  {
    id: 'template-scifi',
    name: 'Neon-Drenched Megacity',
    description: 'A cyberpunk future where megacorporations rule from glittering towers and the streets below teem with hackers, cyborgs, and rebels.',
    category: 'Sci-Fi',
    tags: ['Cyberpunk', 'Dystopian', 'Futuristic'],
    avatar: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏙️</text></svg>',
    entries: [
        { id: crypto.randomUUID(), name: 'OmniCorp', keys: ['OmniCorp', 'the corporation'], content: 'OmniCorp is the largest and most powerful megacorporation, controlling everything from private security to consumer genetics. Its headquarters, the Omni-Spire, pierces the clouds.', enabled: true, category: WorldEntryCategory.FACTION, isAlwaysActive: true },
        { id: crypto.randomUUID(), name: 'Cybernetics', keys: ['cybernetics', 'augments', 'chrome'], content: 'Body modifications are common, ranging from simple datajacks to full cybernetic limbs. The black market for military-grade chrome thrives in the undercity.', enabled: true, category: WorldEntryCategory.LORE },
        { id: crypto.randomUUID(), name: 'The Undercity', keys: ['Undercity', 'the slums'], content: 'The perpetually dark, rain-slicked streets at the base of the city\'s towers. It is a chaotic maze of noodle stands, black market clinics, and hidden nightclubs.', enabled: true, category: WorldEntryCategory.LOCATION },
    ]
  },
];