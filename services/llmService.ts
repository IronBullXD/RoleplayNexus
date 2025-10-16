import { GoogleGenAI, Type } from '@google/genai';
import {
  Message,
  LLMProvider,
  World,
  Persona,
  WorldEntry,
  GroupTurnAction,
  Settings,
} from '../types';
import { API_ENDPOINTS } from '../constants';
import { logger } from './logger';

// Instantiate the Gemini client once at the module level.
// Per guidelines, Gemini API key MUST come from the environment.
const geminiAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Module-level cache for pre-computed world indices.
const worldIndexCache = new Map<string, { index: any; entriesJSON: string }>();


/**
 * A wrapper around fetch that implements exponential backoff for retries.
 * @param url The URL to fetch.
 * @param options The fetch options.
 * @param retries The number of times to retry.
 * @param backoff The backoff factor.
 * @returns A promise that resolves to the fetch response.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  backoff = 300,
): Promise<Response> {
  const [minBackoff, maxBackoff] = [backoff, 5000];
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      // Retry on 5xx server errors
      if (response.status >= 500 && response.status < 600) {
        throw new Error(`Server error: ${response.status}`);
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      const delay = Math.min(minBackoff * Math.pow(2, i), maxBackoff) + Math.random() * 100;
      logger.log(`API call failed, retrying in ${delay.toFixed(0)}ms...`, { attempt: i + 1, error });
      await new Promise(res => setTimeout(res, delay));
    }
  }
  // This line should not be reachable, but is required for type safety.
  throw new Error("Fetch failed after multiple retries.");
}


/**
 * Merges consecutive messages from the same role (user or assistant) into a single message.
 * This is crucial for models like Gemini that require a strict alternating user/model sequence,
 * preventing errors that can occur after chat history edits.
 * @param messages An array of messages.
 * @returns A new array of messages with consecutive roles merged.
 */
function mergeConsecutiveRoleMessages(messages: Message[]): Message[] {
  if (messages.length < 2) {
    return messages;
  }

  const mergedMessages: Message[] = [];
  // Create a copy to avoid mutating the original array from the store
  const tempMessages = JSON.parse(JSON.stringify(messages));

  while (tempMessages.length > 0) {
    let currentMessage = tempMessages.shift()!;
    // System messages are not merged
    if (currentMessage.role === 'system') {
      mergedMessages.push(currentMessage);
      continue;
    }

    // Merge subsequent messages of the same role
    while (
      tempMessages.length > 0 &&
      tempMessages[0].role === currentMessage.role
    ) {
      const nextMessage = tempMessages.shift()!;
      currentMessage.content += `\n\n${nextMessage.content}`;
      currentMessage.timestamp = nextMessage.timestamp; // Take the latest timestamp
    }
    mergedMessages.push(currentMessage);
  }

  return mergedMessages;
}

const estimateTokens = (text: string): number => {
  // A simple approximation: 1 token ~ 4 characters
  return Math.ceil((text || '').length / 4);
};

/**
 * A safe, simple stemmer for English words. It is not perfect but is designed to be
 * non-destructive and handle common cases like plurals and simple verb tenses.
 * @param word The word to stem.
 * @returns The stemmed word.
 */
const stem = (word: string): string => {
  if (word.length < 4) return word;

  // Rule for plurals: cats -> cat, boxes -> box
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us'))
    return word.slice(0, -1);

  // Rule for verbs: walking -> walk, walked -> walk
  // Check length to avoid over-stripping (e.g., "cared" -> "car")
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('ed') && word.length > 5) return word.slice(0, -2);

  return word;
};

/**
 * Builds or retrieves a cached search index for a world's entries.
 * The index is used for fast keyword matching in RAG.
 * @param world The world object.
 * @returns A pre-computed index for the world.
 */
function getOrBuildWorldIndex(world: World) {
  // Use a JSON string of entries as a cheap but effective cache invalidation key.
  const entriesJSON = JSON.stringify(world.entries);
  const cached = worldIndexCache.get(world.id);

  if (cached && cached.entriesJSON === entriesJSON) {
    logger.log('Using cached world index.', { worldId: world.id });
    return cached.index;
  }

  logger.log('Building new world index.', { worldId: world.id });

  const entryIdToEntryMap = new Map<string, WorldEntry>();
  const plainKeywordMap = new Map<string, WorldEntry[]>();
  const stemmedKeywordMap = new Map<string, WorldEntry[]>();
  const regexKeywords: { regex: RegExp; entries: WorldEntry[] }[] = [];
  const allEnabledEntries = world.entries.filter((e) => e.enabled);

  for (const entry of allEnabledEntries) {
    entryIdToEntryMap.set(entry.id, entry);
    if (entry.keys) {
      for (const key of entry.keys) {
        const lowerKey = key.trim().toLowerCase();
        if (lowerKey.length < 2) continue;

        if (/[*+?()|[\]{}^$\\]/.test(lowerKey)) {
          try {
            const regex = new RegExp(`\\b(${lowerKey})\\b`, 'gi');
            regexKeywords.push({ regex, entries: [entry] });
          } catch (e) {
            if (!plainKeywordMap.has(lowerKey))
              plainKeywordMap.set(lowerKey, []);
            plainKeywordMap.get(lowerKey)!.push(entry);
          }
        } else {
          if (!plainKeywordMap.has(lowerKey))
            plainKeywordMap.set(lowerKey, []);
          plainKeywordMap.get(lowerKey)!.push(entry);

          const stemmedKey = stem(lowerKey);
          if (stemmedKey !== lowerKey) {
            if (!stemmedKeywordMap.has(stemmedKey))
              stemmedKeywordMap.set(stemmedKey, []);
            stemmedKeywordMap.get(stemmedKey)!.push(entry);
          }
        }
      }
    }
  }

  const index = {
    plainKeywordMap,
    stemmedKeywordMap,
    regexKeywords,
    stem,
    entryIdToEntryMap,
  };
  worldIndexCache.set(world.id, { index, entriesJSON });
  return index;
}

// --- RAG & Suggestion Helpers (Hoisted for reuse) ---
const findMatchesInText = (
  text: string,
  worldIndex: ReturnType<typeof getOrBuildWorldIndex>,
) => {
  const localMatches = new Map<
    string,
    { entry: WorldEntry; count: number; reasons: Set<string> }
  >();
  const addLocalMatch = (entry: WorldEntry, reason: string) => {
    if (!localMatches.has(entry.id))
      localMatches.set(entry.id, { entry, count: 0, reasons: new Set() });
    const match = localMatches.get(entry.id)!;
    match.count++;
    match.reasons.add(reason);
  };

  if (!text) return localMatches;
  const lowerText = text.toLowerCase();

  // Regex matches
  worldIndex.regexKeywords.forEach(
    ({ regex, entries }: { regex: RegExp; entries: WorldEntry[] }) => {
      const matches = lowerText.match(regex);
      if (matches) {
        entries.forEach((entry) => {
          for (let i = 0; i < matches.length; i++)
            addLocalMatch(entry, `Regex: "${regex.source.replace(/\\b/g, '')}"`);
        });
      }
    },
  );

  // Token-based matches (exact, stemmed)
  const words = lowerText.match(/\b[\w'-]+\b/g) || [];
  for (const word of new Set(words)) {
    if (worldIndex.plainKeywordMap.has(word)) {
      worldIndex.plainKeywordMap
        .get(word)!
        .forEach((entry: WorldEntry) =>
          addLocalMatch(entry, `Exact: "${word}"`),
        );
    }
    const stemmedWord = worldIndex.stem(word);
    if (worldIndex.stemmedKeywordMap.has(stemmedWord)) {
      worldIndex.stemmedKeywordMap.get(stemmedWord)!.forEach((entry: WorldEntry) => {
        const plainKeys = (entry.keys || []).map((k) => k.toLowerCase().trim());
        if (!plainKeys.includes(word))
          addLocalMatch(entry, `Stem: "${word}" -> "${stemmedWord}"`);
      });
    }
  }
  return localMatches;
};


export function findRelevantEntries({
  messages,
  world,
}: {
  messages: Message[];
  world: World;
}): WorldEntry[] {
  const MAX_SUGGESTIONS = 5;
  const allEnabledEntries = world.entries.filter((e) => e.enabled);
  if (allEnabledEntries.length === 0) return [];

  const worldIndex = getOrBuildWorldIndex(world);
  const { entryIdToEntryMap } = worldIndex;

  const candidateScores = new Map<string, { score: number; reasons: Set<string> }>();
  const addScore = (entry: WorldEntry, score: number, reason: string) => {
    if (!candidateScores.has(entry.id))
      candidateScores.set(entry.id, { score: 0, reasons: new Set() });
    const current = candidateScores.get(entry.id)!;
    current.score += score;
    current.reasons.add(reason);
  };
  
  const searchContext = (text: string, baseScore: number, type: string) => {
    const matches = findMatchesInText(text, worldIndex);
    for (const matchData of matches.values()) {
      const frequencyBonus = Math.pow(matchData.count, 1.2);
      const finalScore = baseScore * frequencyBonus;
      const reasonSummary = Array.from(matchData.reasons).slice(0, 2).join(', ');
      addScore(
        matchData.entry,
        finalScore,
        `${type}: ${reasonSummary} (x${matchData.count})`,
      );
    }
  };

  messages.forEach((message, i) => {
    const recency = messages.length - 1 - i;
    const recencyScore = Math.max(2, 12 - recency * 2);
    searchContext(message.content, recencyScore, `Message (t-${recency})`);
  });

  if (candidateScores.size === 0) return [];

  const lastMessageContent = messages[messages.length - 1]?.content.toLowerCase() || '';

  const rankedCandidates = Array.from(candidateScores.entries())
    .map(([id, data]) => ({
      entry: entryIdToEntryMap.get(id)!,
      ...data,
    }))
    .filter(({ entry }) => !entry.isAlwaysActive)
    .filter(({ entry }) => {
        // Don't suggest entries that were literally just named
        const name = entry.name?.toLowerCase();
        return name ? !lastMessageContent.includes(name) : true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS);

  return rankedCandidates.map((c) => c.entry);
}


interface CompletionParams {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  messages: Message[];
  characterPersona: string;
  userPersona?: Persona | null;
  globalSystemPrompt: string;
  world?: World | null;
  temperature: number;
  prefill?: string;
  signal?: AbortSignal;
  contextSize: number;
  maxOutputTokens: number;
  memorySummary?: string;
  characterName?: string; // For single chat
  activeCharacterNames?: string[]; // For group chat
  interactionData?: Record<string, { viewCount: number; lastViewed: number }>;
  // FIX: Add settings to CompletionParams to make it available for the thinking service.
  settings: Settings;
}

export interface GeneratedCharacterProfile {
  name: string;
  greeting: string;
  description: string;
  persona: string;
}

interface GenerateCharacterParams {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  concept: string;
}

interface SummarizeParams {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  messages: Message[];
  previousSummary?: string;
}

export interface InconsistencyReport {
  explanation: string;
  conflictingEntryIds: string[];
}

interface ConsistencyCheckParams {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  world: World;
}


export async function checkForInconsistencies({
  provider,
  apiKey,
  model,
  world,
}: ConsistencyCheckParams): Promise<InconsistencyReport[]> {
    const systemPrompt = `You are a meticulous continuity editor for a fictional world. Your task is to analyze a set of lore entries and identify any direct contradictions or significant logical inconsistencies.

CRITICAL INSTRUCTIONS:
1.  Read all the provided lore entries carefully. Each entry has a unique ID.
2.  Identify pairs or groups of entries that contain conflicting information. Focus on direct contradictions (e.g., "The king is alive" vs. "The king is dead"; "Magic is impossible" vs. "She is a wizard").
3.  For each contradiction you find, you MUST provide a concise explanation of the conflict and the exact IDs of the entries involved.
4.  If there are no contradictions, return an empty array.
5.  Your response MUST be a valid JSON array matching the provided schema. Do not include any text outside of the JSON structure.`;
    
    const worldContent = world.entries
      .filter(e => e.enabled && e.content)
      .map(entry => `--- Entry ID: ${entry.id}, Name: ${entry.name || 'Unnamed'} ---\n${entry.content}`)
      .join('\n\n');
      
    if (!worldContent) {
        return []; // No content to check
    }

    const userPrompt = `Here are the lore entries for the world of "${world.name}". Please analyze them for contradictions.\n\n${worldContent}`;

    const requestData = { provider, model, worldName: world.name };
    logger.apiRequest('Checking for world inconsistencies', requestData);

    try {
        if (provider === LLMProvider.GEMINI) {
            const response = await geminiAI.models.generateContent({
                model: model,
                contents: userPrompt,
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.2, // Lower temperature for more analytical task
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                explanation: {
                                    type: Type.STRING,
                                    description: "A clear and concise explanation of the contradiction."
                                },
                                conflictingEntryIds: {
                                    type: Type.ARRAY,
                                    description: "An array of the string IDs of the entries that conflict with each other.",
                                    items: { type: Type.STRING }
                                }
                            },
                            required: ["explanation", "conflictingEntryIds"],
                        }
                    },
                }
            });

            const jsonStr = response.text.trim();
            const report = JSON.parse(jsonStr) as InconsistencyReport[];
            logger.apiResponse('Inconsistency check successful', { response: report });
            return report;
        } else {
             const endpoint = API_ENDPOINTS[provider as keyof typeof API_ENDPOINTS];
            if (!endpoint) throw new Error(`API endpoint for ${provider} is not configured.`);
            
            const openAIPrompt = `${systemPrompt}\n\n${userPrompt}`;
            const body = {
                model,
                messages: [
                    { role: "system", content: "You are a helpful assistant that only responds in JSON." },
                    { role: "user", content: openAIPrompt }
                ],
                temperature: 0.2,
                response_format: { type: "json_object" },
            };
            
            const response = await fetchWithRetry(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error(`API request failed with status ${response.status}: ${await response.text()}`);

            const data = await response.json();
            const content = data.choices[0]?.message?.content;
            if (!content) throw new Error('Invalid response format from API.');

            // Attempt to parse what might be inside the content
            const parsed = JSON.parse(content);
            const report = (parsed.contradictions || parsed) as InconsistencyReport[];

            logger.apiResponse('Inconsistency check successful', { response: report });
            return Array.isArray(report) ? report : [];
        }
    } catch (error) {
        logger.error('World inconsistency check failed', { error, requestData });
        throw error;
    }
}


export async function summarizeMessages({
  provider,
  apiKey,
  model,
  messages,
  previousSummary,
}: SummarizeParams): Promise<string> {
  const systemPrompt = `You are an expert at creating and updating conversation summaries. Your task is to produce a new, consolidated summary.

Instructions:
1.  Read the "PREVIOUS SUMMARY" (if provided). This is the condensed history of events so far.
2.  Read the "NEW CONVERSATION LOG". These are the most recent messages that need to be integrated.
3.  Combine both sources into a single, coherent, and updated summary.
4.  The new summary MUST be written in the third person.
5.  It MUST capture all key events, character developments, important decisions, new lore, and crucial facts.
6.  CRITICAL: Do NOT repeat information. If the new log clarifies or supersedes something from the previous summary, update it. Keep the summary as concise as possible while retaining vital information.`;

  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const userPromptParts = [];
  if (previousSummary) {
    userPromptParts.push('### PREVIOUS SUMMARY ###');
    userPromptParts.push(previousSummary);
  }
  userPromptParts.push('### NEW CONVERSATION LOG ###');
  userPromptParts.push(conversationText);
  userPromptParts.push(
    '\nBased on the instructions, provide the new, consolidated summary.',
  );
  const userPrompt = userPromptParts.join('\n\n');

  const requestData = { provider, model };
  logger.apiRequest('Summarizing conversation', requestData);

  try {
    if (provider === LLMProvider.GEMINI) {
      const response = await geminiAI.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: { systemInstruction: systemPrompt },
      });
      const summary = response.text.trim();
      logger.apiResponse('Summarization successful', { summary });
      return summary;
    } else {
      const endpoint = API_ENDPOINTS[provider as keyof typeof API_ENDPOINTS];
      if (!endpoint)
        throw new Error(`API endpoint for ${provider} is not configured.`);

      const body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Lower temperature for more factual summary
      };

      const response = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok)
        throw new Error(
          `API request failed with status ${response.status}: ${await response.text()}`,
        );

      const data = await response.json();
      const summary = data.choices[0]?.message?.content?.trim();
      if (!summary)
        throw new Error('Invalid response format from summarization API.');
      logger.apiResponse('Summarization successful', { summary });
      return summary;
    }
  } catch (error) {
    logger.error('Summarization failed', { error, requestData });
    throw error;
  }
}

export async function generateCharacterProfile({
  provider,
  apiKey,
  model,
  concept,
}: GenerateCharacterParams): Promise<GeneratedCharacterProfile> {
  const systemPrompt = `
You are a creative assistant that designs compelling characters for a roleplaying game. Based on the user's concept, generate a complete character profile. The profile must include a unique name, a short greeting message, a brief description for a character list, and a detailed persona for the AI to use.

CRITICAL INSTRUCTIONS FOR THE 'greeting' FIELD:
The greeting message MUST adhere to the following markdown-style formatting rules:
1. Enclose all dialogue and spoken words in double quotation marks. Example: "Hello, what is your name?"
2. Enclose all actions, descriptions of actions, and non-dialogue text in asterisks. Example: *He looks around the room cautiously.*
A valid greeting might look like this: *He smiled warmly and extended his hand.* "It's a pleasure to finally meet you."

CRITICAL INSTRUCTIONS FOR THE 'persona' FIELD:
1. The persona MUST be written in the third person (e.g., "He is...", "She feels..."). Do NOT use first-person perspective ("I am...", "I feel...").
2. The persona MUST be well-organized and formatted with the following headers, each on its own line, followed by the content on the next line(s). Use this exact structure:

Appearance:
[Detailed and explicit physical description including height, build, hair, eyes, clothing, and intimate details such as breast size, body shape, and other NSFW attributes. Be descriptive and uncensored.]

Personality:
[Key traits, behaviors, and common mannerisms.]

Speaking style:
[How they talk, their accent, vocabulary, etc.]

Background:
[A brief history of the character.]

Motivations:
[What drives the character.]

Respond ONLY with a valid JSON object matching the provided schema.
  `.trim();

  const userPrompt = `Concept: "${concept}"`;

  const requestData = { provider, model, concept };
  logger.apiRequest('Generating character profile', requestData);

  try {
    if (provider === LLMProvider.GEMINI) {
      const response = await geminiAI.models.generateContent({
        model: model,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: "The character's full name.",
              },
              greeting: {
                type: Type.STRING,
                description:
                  'A welcoming message the character would say when first meeting someone. It must be formatted with dialogue in quotes and actions in asterisks.',
              },
              description: {
                type: Type.STRING,
                description:
                  'A brief, one-to-two sentence summary of the character for a selection screen.',
              },
              persona: {
                type: Type.STRING,
                description:
                  "A detailed description of the character's persona. CRITICAL: It must be written in the third person and structured with the following headers, each on a new line: 'Appearance:', 'Personality:', 'Speaking style:', 'Background:', and 'Motivations:'. The Appearance section MUST be detailed and explicit, including intimate details like breast size, body shape, and other NSFW attributes without censorship.",
              },
            },
            required: ['name', 'greeting', 'description', 'persona'],
          },
        },
      });

      const jsonStr = response.text.trim();
      const profile = JSON.parse(jsonStr) as GeneratedCharacterProfile;
      logger.apiResponse('Character profile generated successfully', {
        response: profile,
      });
      return profile;
    } else {
      const endpoint = API_ENDPOINTS[provider as keyof typeof API_ENDPOINTS];
      if (!endpoint)
        throw new Error(`API endpoint for ${provider} is not configured.`);

      const body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      };

      const response = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `API request failed with status ${response.status}: ${errorBody}`,
        );
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      if (!content) {
        logger.error('Invalid API response format (missing content)', {
          responseData: data,
        });
        throw new Error('Invalid response format from API.');
      }
      const profile = JSON.parse(content) as GeneratedCharacterProfile;
      logger.apiResponse('Character profile generated successfully', {
        response: profile,
      });
      return profile;
    }
  } catch (error) {
    logger.error('Character generation failed', { error, requestData });
    throw error; // Re-throw the original error after logging
  }
}

async function* parseOpenAIStream(
  readableStream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = readableStream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    if (signal?.aborted) {
      reader.cancel('Stream aborted by user');
      break;
    }

    const { done, value } = await reader.read();
    if (done) {
      if (buffer) {
        logger.error('Stream ended with unprocessed data in buffer', {
          buffer,
        });
      }
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep the last, possibly incomplete line

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.substring(6);
        if (jsonStr === '[DONE]') {
          return;
        }
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch (e) {
          logger.error('Error parsing stream JSON chunk', {
            jsonStr,
            error: e,
          });
        }
      }
    }
  }
}

async function* getGeminiCompletionStream(
  messages: Message[],
  model: string,
  temperature: number,
  maxOutputTokens: number,
  prefill?: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const systemPrompt = messages.find((m) => m.role === 'system')?.content || '';
  const chatMessages = messages.filter((m) => m.role !== 'system');

  const contents = chatMessages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  if (prefill) {
    // Add the start of the model's response to guide it
    contents.push({ role: 'model', parts: [{ text: prefill }] });
  }

  const geminiConfig: {
    temperature: number;
    systemInstruction: string;
    maxOutputTokens?: number;
  } = {
    temperature: temperature,
    systemInstruction: systemPrompt,
  };

  if (maxOutputTokens > 0) {
    geminiConfig.maxOutputTokens = maxOutputTokens;
  }

  const responseStream = await geminiAI.models.generateContentStream({
    model: model,
    contents: contents,
    config: geminiConfig,
  });

  for await (const chunk of responseStream) {
    if (signal?.aborted) {
      logger.log('Gemini stream generation stopped by user.');
      break;
    }
    if (chunk.text) {
      yield chunk.text;
    }
  }
}

async function* getOpenAICompatibleCompletionStream(
  provider: LLMProvider.OPENROUTER | LLMProvider.DEEPSEEK,
  apiKey: string,
  messages: Message[],
  model: string,
  temperature: number,
  maxOutputTokens: number,
  prefill?: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const endpoint = API_ENDPOINTS[provider];

  const apiMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  if (prefill) {
    apiMessages.push({ role: 'assistant', content: prefill });
  }

  const body: {
    model: string;
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
    temperature: number;
    stream: true;
    max_tokens?: number;
  } = {
    model,
    messages: apiMessages,
    temperature: temperature,
    stream: true,
  };

  if (maxOutputTokens > 0) {
    body.max_tokens = maxOutputTokens;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    if (signal?.aborted) {
      throw new DOMException('The user aborted a request.', 'AbortError');
    }
    let errorBodyText = `(Could not read error body)`;
    try {
      errorBodyText = await response.text();
    } catch (e) {
      logger.error('Failed to read error response body', { originalError: e });
    }

    logger.error(`OpenAI-compatible API request failed: ${response.status}`, {
      provider,
      status: response.status,
      body: errorBodyText,
      requestBody: body,
    });
    const error = new Error(
      `API request failed with status ${response.status}: ${errorBodyText}`,
    );
    (error as any).status = response.status;
    throw error;
  }

  if (!response.body) {
    logger.error('OpenAI-compatible API response body is empty', { provider });
    throw new Error('The response body is empty.');
  }

  yield* parseOpenAIStream(response.body, signal);
}

export async function* getChatCompletionStream(
  params: CompletionParams,
): AsyncGenerator<string> {
  const {
    provider,
    apiKey,
    model,
    messages,
    characterPersona,
    userPersona,
    globalSystemPrompt,
    world,
    temperature,
    prefill,
    signal,
    contextSize,
    maxOutputTokens,
    memorySummary,
    characterName,
    activeCharacterNames,
    interactionData,
  } = params;

  if (!model?.trim()) {
    throw new Error(
      `Model name for ${provider} is not configured. Please set it in API Settings.`,
    );
  }

  const promptParts: string[] = [];

  promptParts.push('### CORE INSTRUCTIONS & GUIDELINES ###');
  promptParts.push(globalSystemPrompt);

  if (userPersona) {
    promptParts.push('### USER PERSONA ###');
    promptParts.push(
      'This is the persona of the user you are roleplaying with. Keep their details in mind for your responses.',
    );
    promptParts.push(`- **Name:** ${userPersona.name}`);
    promptParts.push(`- **Description:** ${userPersona.description}`);
  }

  if (memorySummary) {
    promptParts.push('### CONVERSATION SUMMARY ###');
    promptParts.push(
      'This is a summary of the conversation so far. Use it to maintain context and continuity.',
    );
    promptParts.push(`---\n${memorySummary}\n---`);
  }

  // --- Smart World Lore Retrieval (RAG v5) ---
  const MAX_LORE_ENTRIES = 7;

  if (world?.entries && world.entries.length > 0) {
    const allEnabledEntries = world.entries.filter((e) => e.enabled);
    if (allEnabledEntries.length > 0) {
      // 1. Build advanced keyword index by retrieving from cache or computing.
      const worldIndex = getOrBuildWorldIndex(world);
      const { entryIdToEntryMap } = worldIndex;

      const candidateScores = new Map<
        string,
        { score: number; reasons: Set<string> }
      >();
      const addScore = (entry: WorldEntry, score: number, reason: string) => {
        if (!candidateScores.has(entry.id))
          candidateScores.set(entry.id, { score: 0, reasons: new Set() });
        const current = candidateScores.get(entry.id)!;
        current.score += score;
        current.reasons.add(reason);
      };

      // 2. Base scores: Always-active and user feedback
      for (const entry of allEnabledEntries) {
        if (entry.isAlwaysActive) addScore(entry, 100, 'Always Active');
        if (interactionData && interactionData[entry.id]) {
          const interactionScore = Math.round(
            Math.log1p(interactionData[entry.id].viewCount) * 15,
          );
          if (interactionScore > 0)
            addScore(
              entry,
              interactionScore,
              `User Interaction (${interactionData[entry.id].viewCount} views)`,
            );
        }
      }

      // 3. Character relationship scores
      const allActiveChars = [
        characterName,
        ...(activeCharacterNames || []),
      ].filter(Boolean) as string[];
      if (allActiveChars.length > 0) {
        for (const charName of allActiveChars) {
          const lowerCharName = charName.toLowerCase();
          if (worldIndex.plainKeywordMap.has(lowerCharName)) {
            worldIndex.plainKeywordMap
              .get(lowerCharName)!
              .forEach((entry: WorldEntry) => {
                addScore(
                  entry,
                  50,
                  `Linked to active character: "${charName}"`,
                );
              });
          }
        }
      }

      // 4. Contextual search with smart matching
      const searchContext = (text: string, baseScore: number, type: string) => {
        const matches = findMatchesInText(text, worldIndex);
        for (const matchData of matches.values()) {
          const frequencyBonus = Math.pow(matchData.count, 1.2);
          const finalScore = baseScore * frequencyBonus;
          const reasonSummary = Array.from(matchData.reasons)
            .slice(0, 2)
            .join(', ');
          addScore(
            matchData.entry,
            finalScore,
            `${type}: ${reasonSummary} (x${matchData.count})`,
          );
        }
      };

      const recentMessages = messages.slice(-5);
      recentMessages.forEach((message, i) => {
        const recency = recentMessages.length - 1 - i;
        const recencyScore = Math.max(2, 12 - recency * 2);
        searchContext(message.content, recencyScore, `Message (t-${recency})`);
      });

      searchContext(userPersona?.description, 5, 'User Persona');
      searchContext(characterPersona, 3, 'Character Persona');

      // 5. Rank and select top entries
      if (candidateScores.size > 0) {
        const rankedCandidates = Array.from(candidateScores.entries())
          .map(([id, data]) => ({
            entry: entryIdToEntryMap.get(id)!,
            ...data,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_LORE_ENTRIES);

        if (rankedCandidates.length > 0) {
          const finalEntries = rankedCandidates.map((c) => c.entry);
          promptParts.push('### RELEVANT WORLD LORE ###');
          promptParts.push(
            'The following lore entries are relevant to the current scene. You MUST consult them for context and consistency.',
          );
          const lorebookContent = finalEntries
            .map(
              (entry) =>
                `--- Entry: ${entry.name || 'Untitled'} (Keywords: ${(
                  entry.keys || []
                ).join(', ')}) ---\n${entry.content}`,
            )
            .join('\n\n');
          promptParts.push(lorebookContent);

          logger.log('Injected ranked lore entries', {
            count: finalEntries.length,
            world: world?.name,
            entries: rankedCandidates.map((c) => ({
              name: c.entry.name,
              score: Math.round(c.score),
              reasons: Array.from(c.reasons),
            })),
          });
        }
      }
    }
  }

  promptParts.push('### YOUR CHARACTER ###');
  promptParts.push(
    `This is your character's persona for this scene. You must fully embody this character.`,
  );
  promptParts.push(characterPersona);

  const finalSystemPrompt = promptParts.join('\n\n');

  // Token Management - Truncate messages to fit context window
  const availableTokensForHistory = contextSize;

  const truncatedMessages: Message[] = [];
  let usedTokens = 0;

  // Iterate backwards through messages to keep the most recent ones
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const messageTokens = estimateTokens(message.content);
    if (usedTokens + messageTokens > availableTokensForHistory) {
      logger.log(`Context limit reached. Truncating messages.`, {
        availableTokens: availableTokensForHistory,
        usedTokens,
        totalMessages: messages.length,
        messagesKept: truncatedMessages.length,
      });
      break;
    }
    truncatedMessages.unshift(message); // Add to the beginning of the array
    usedTokens += messageTokens;
  }

  // Merge consecutive messages to prevent API errors from non-alternating roles
  const mergedHistory = mergeConsecutiveRoleMessages(truncatedMessages);

  const systemMessage: Message = {
    id: 'system-prompt-message',
    role: 'system',
    content: finalSystemPrompt,
  };

  const apiMessages = [
    systemMessage,
    ...mergedHistory.filter((m) => m.role !== 'system'),
  ];

  // Now call the appropriate stream generator based on provider.
  if (provider === LLMProvider.GEMINI) {
    yield* getGeminiCompletionStream(
      apiMessages,
      model,
      temperature,
      maxOutputTokens,
      prefill,
      signal,
    );
  } else if (
    provider === LLMProvider.OPENROUTER ||
    provider === LLMProvider.DEEPSEEK
  ) {
    yield* getOpenAICompatibleCompletionStream(
      provider,
      apiKey,
      apiMessages,
      model,
      temperature,
      maxOutputTokens,
      prefill,
      signal,
    );
  } else {
    logger.error(`Unsupported provider in getChatCompletionStream: ${provider}`);
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

interface GroupCompletionParams
  extends Omit<
    CompletionParams,
    'characterPersona' | 'characterName' | 'prefill'
  > {
  scenario: string;
  sessionCharacters: { name: string; persona: string }[];
}

export async function getGroupChatCompletion(
  params: GroupCompletionParams,
): Promise<GroupTurnAction[]> {
  const {
    provider,
    apiKey,
    model,
    messages: allMessages,
    userPersona,
    globalSystemPrompt,
    world,
    temperature,
    contextSize,
    maxOutputTokens,
    memorySummary,
    sessionCharacters,
    scenario,
    interactionData,
  } = params;

  if (!model?.trim()) {
    throw new Error(
      `Model name for ${provider} is not configured. Please set it in API Settings.`,
    );
  }

  const promptParts: string[] = [];

  promptParts.push('### CORE INSTRUCTIONS: GROUP SCENE DIRECTOR ###');
  promptParts.push(
    `You are a master storyteller and scene director for a multi-character roleplay. Your task is to advance the scene based on the latest user message and the established context. You must direct the characters, deciding who speaks or acts. You can have one or multiple characters act in a single turn. You can also include narrative descriptions.`,
  );

  promptParts.push('### SCENE DETAILS ###');
  promptParts.push(`**Scenario:** ${scenario}`);
  promptParts.push(
    `**Characters in Scene:**\n${sessionCharacters
      .map((c) => `- ${c.name}`)
      .join('\n')}`,
  );

  promptParts.push('### ROLEPLAY GUIDELINES ###');
  promptParts.push(globalSystemPrompt);

  if (userPersona) {
    promptParts.push('### USER PERSONA ###');
    promptParts.push('This is the persona of the user you are roleplaying with.');
    promptParts.push(`- **Name:** ${userPersona.name}`);
    promptParts.push(`- **Description:** ${userPersona.description}`);
  }

  if (memorySummary) {
    promptParts.push('### CONVERSATION SUMMARY ###');
    promptParts.push('This is a summary of the conversation so far.');
    promptParts.push(`---\n${memorySummary}\n---`);
  }

  // Simplified RAG for group chat (could be expanded)
  if (world?.entries) {
    const activeEntries = world.entries.filter(
      (e) => e.enabled && e.isAlwaysActive,
    );
    if (activeEntries.length > 0) {
      promptParts.push('### RELEVANT WORLD LORE ###');
      promptParts.push(
        'The following lore entries are relevant. You MUST consult them for context and consistency.',
      );
      promptParts.push(
        activeEntries.map((e) => e.content).join('\n---\n'),
      );
    }
  }

  promptParts.push('### FULL CHARACTER PERSONAS ###');
  promptParts.push(
    'This is a reference for all characters in the scene. Use it to ensure their actions and dialogue are in-character.',
  );
  promptParts.push(
    sessionCharacters
      .map((c) => `--- ${c.name} ---\n${c.persona}\n---`)
      .join('\n\n'),
  );

  const finalSystemPrompt = promptParts.join('\n\n');

  // Token Management
  const availableTokensForHistory = contextSize;
  const truncatedMessages: Message[] = [];
  let usedTokens = 0;
  for (let i = allMessages.length - 1; i >= 0; i--) {
    const message = allMessages[i];
    const messageTokens = estimateTokens(message.content);
    if (usedTokens + messageTokens > availableTokensForHistory) break;
    truncatedMessages.unshift(message);
    usedTokens += messageTokens;
  }
  const mergedHistory = mergeConsecutiveRoleMessages(truncatedMessages);

  if (provider === LLMProvider.GEMINI) {
    const geminiPrompt = `${finalSystemPrompt}\n\n### RESPONSE FORMAT ###\nBased on the conversation history, generate the next turn in the scene as an array of actions.
- For a character's turn, use their exact name for "characterName".
- For narrative descriptions of the scene, use the special name "Narrator" for "characterName".
- "content" should be a string containing the dialogue and/or actions, following standard roleplay format (e.g., *He looks around.* "What was that?").`;

    const response = await geminiAI.models.generateContent({
      model,
      contents: [
        ...mergedHistory.map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
      ],
      config: {
        systemInstruction: geminiPrompt,
        temperature,
        maxOutputTokens,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              characterName: { type: Type.STRING },
              content: { type: Type.STRING },
            },
            required: ['characterName', 'content'],
          },
        },
      },
    });
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr) as GroupTurnAction[];
  } else {
    // OpenAI-compatible
    const openAIPrompt = `${finalSystemPrompt}\n\n### RESPONSE FORMAT ###\nYOUR RESPONSE MUST BE A VALID JSON OBJECT with a single key "turn".
The value of "turn" must be an array of action objects.
Each object in the array represents a single character's action or dialogue, or a narrative description.

The JSON schema for each object is: { "characterName": string, "content": string }
- For a character's turn, "characterName" MUST be their exact name from the character list.
- For narrative descriptions of the scene, use the special name "Narrator" for "characterName".
- "content" should be a string containing the dialogue and/or actions, following standard roleplay format (e.g., *He looks around.* "What was that?").

Based on the conversation history, generate the next turn in the scene.`;

    const body = {
      model,
      messages: [
        { role: 'system', content: openAIPrompt },
        ...mergedHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ],
      temperature,
      max_tokens: maxOutputTokens,
      response_format: { type: 'json_object' },
    };

    const response = await fetchWithRetry(API_ENDPOINTS[provider as keyof typeof API_ENDPOINTS], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const error = new Error(`API request failed with status ${response.status}: ${errorBody}`);
      (error as any).status = response.status;
      throw error;
    }
    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('Invalid response format from API.');
    const parsed = JSON.parse(content);
    if (!parsed.turn || !Array.isArray(parsed.turn))
      throw new Error('API did not return a `turn` array.');
    return parsed.turn as GroupTurnAction[];
  }
}