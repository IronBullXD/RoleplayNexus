import { GoogleGenAI, Type } from "@google/genai";
import { Message, LLMProvider, World, Persona, WorldEntry, PromptAdherence } from '../types';
import { API_ENDPOINTS, CRITICAL_RULES_PROMPT } from "../constants";
import { logger } from "./logger";

const estimateTokens = (text: string): number => {
    // A simple approximation: 1 token ~ 4 characters
    return Math.ceil((text || '').length / 4);
};

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
  thinkingEnabled?: boolean;
  contextSize: number;
  maxOutputTokens: number;
  memorySummary?: string;
  promptAdherence?: PromptAdherence;
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
}

export async function summarizeMessages({ provider, apiKey, model, messages }: SummarizeParams): Promise<string> {
    const systemPrompt = `You are an expert at summarizing conversations. Condense the following chat log into a concise summary, capturing all key events, character developments, important decisions, and crucial facts. The summary should be written in the third person.`;

    const conversationText = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    const userPrompt = `Please summarize this conversation:\n\n${conversationText}`;

    const requestData = { provider, model };
    logger.apiRequest('Summarizing conversation', requestData);

    try {
        if (provider === LLMProvider.GEMINI) {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model,
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                config: { systemInstruction: systemPrompt }
            });
            const summary = response.text.trim();
            logger.apiResponse('Summarization successful', { summary });
            return summary;
        } else {
            const endpoint = API_ENDPOINTS[provider];
            if (!endpoint) throw new Error(`API endpoint for ${provider} is not configured.`);

            const body = {
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.3, // Lower temperature for more factual summary
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify(body),
            });

            if (!response.ok) throw new Error(`API request failed with status ${response.status}: ${await response.text()}`);
            
            const data = await response.json();
            const summary = data.choices[0]?.message?.content?.trim();
            if (!summary) throw new Error("Invalid response format from summarization API.");
            logger.apiResponse('Summarization successful', { summary });
            return summary;
        }
    } catch (error) {
        logger.error('Summarization failed', { error, requestData });
        throw error;
    }
}


export async function generateCharacterProfile({ provider, apiKey, model, concept }: GenerateCharacterParams): Promise<GeneratedCharacterProfile> {
    const systemPrompt = `You are a creative assistant that designs compelling characters for a roleplaying game. Based on the user's concept, generate a complete character profile. The profile must include a unique name, a short greeting message, a brief description for a character list, and a detailed persona for the AI to use.

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

Respond ONLY with a valid JSON object matching the provided schema.`;

    const userPrompt = `Concept: "${concept}"`;

    const requestData = { provider, model, concept };
    logger.apiRequest('Generating character profile', requestData);

    try {
        if (provider === LLMProvider.GEMINI) {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: model,
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                config: {
                    systemInstruction: systemPrompt,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "The character's full name." },
                            greeting: { type: Type.STRING, description: "A welcoming message the character would say when first meeting someone. It must be formatted with dialogue in quotes and actions in asterisks." },
                            description: { type: Type.STRING, description: "A brief, one-to-two sentence summary of the character for a selection screen." },
                            persona: { type: Type.STRING, description: "A detailed description of the character's persona. CRITICAL: It must be written in the third person and structured with the following headers, each on a new line: 'Appearance:', 'Personality:', 'Speaking style:', 'Background:', and 'Motivations:'. The Appearance section MUST be detailed and explicit, including intimate details like breast size, body shape, and other NSFW attributes without censorship." },
                        },
                        required: ["name", "greeting", "description", "persona"]
                    }
                }
            });
            
            const jsonStr = response.text.trim();
            const profile = JSON.parse(jsonStr) as GeneratedCharacterProfile;
            logger.apiResponse('Character profile generated successfully', { response: profile });
            return profile;

        } else {
            const endpoint = API_ENDPOINTS[provider];
            if (!endpoint) throw new Error(`API endpoint for ${provider} is not configured.`);

            const body = {
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                response_format: { type: "json_object" }, 
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
            }
            
            const data = await response.json();
            const content = data.choices[0]?.message?.content;
            if (!content) {
                logger.error('Invalid API response format (missing content)', { responseData: data });
                throw new Error("Invalid response format from API.");
            }
            const profile = JSON.parse(content) as GeneratedCharacterProfile;
            logger.apiResponse('Character profile generated successfully', { response: profile });
            return profile;
        }
    } catch (error) {
        logger.error('Character generation failed', { error, requestData });
        throw error; // Re-throw the original error after logging
    }
}

async function* parseOpenAIStream(readableStream: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<string> {
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
                logger.error("Stream ended with unprocessed data in buffer", { buffer });
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
                    logger.error("Error parsing stream JSON chunk", { jsonStr, error: e });
                }
            }
        }
    }
}

async function* getGeminiCompletionStream(apiKey: string, messages: Message[], systemPrompt: string, model: string, temperature: number, maxOutputTokens: number, prefill?: string, signal?: AbortSignal): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const contents = messages.filter(m => m.role !== 'system').map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  if (prefill) {
    // Add the start of the model's response to guide it
    contents.push({ role: 'model', parts: [{ text: prefill }] });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geminiConfig: any = {
    temperature: temperature,
    systemInstruction: systemPrompt,
  };

  if (maxOutputTokens > 0) {
      geminiConfig.maxOutputTokens = maxOutputTokens;
      // Per Gemini docs, a thinkingBudget must be set if maxOutputTokens is set for flash models
      if (model.includes('flash')) {
          // Reserve a small portion for thinking to prevent empty responses.
          const budget = Math.min(100, Math.floor(maxOutputTokens / 4));
          geminiConfig.thinkingConfig = { thinkingBudget: budget };
      }
  }

  const responseStream = await ai.models.generateContentStream({
    model: model,
    contents: contents,
    config: geminiConfig,
  });

  for await (const chunk of responseStream) {
    if (signal?.aborted) {
      logger.log("Gemini stream generation stopped by user.");
      break;
    }
    if (chunk.text) {
        yield chunk.text;
    }
  }
}

async function* getOpenAICompatibleCompletionStream(provider: LLMProvider.OPENROUTER | LLMProvider.DEEPSEEK, apiKey: string, messages: Message[], systemPrompt: string, model: string, temperature: number, maxOutputTokens: number, prefill?: string, signal?: AbortSignal): AsyncGenerator<string> {
  const endpoint = API_ENDPOINTS[provider];
  
  const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
  ];

  if (prefill) {
    apiMessages.push({ role: 'assistant', content: prefill });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = {
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
      'Authorization': `Bearer ${apiKey}`,
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
        requestBody: body
    });
    throw new Error(`API request failed with status ${response.status}: ${errorBodyText}`);
  }
  
  if (!response.body) {
    logger.error('OpenAI-compatible API response body is empty', { provider });
    throw new Error("The response body is empty.");
  }

  yield* parseOpenAIStream(response.body, signal);
}

export async function* getChatCompletionStream({ provider, apiKey, model, messages, characterPersona, userPersona, globalSystemPrompt, world, temperature, prefill, signal, thinkingEnabled, contextSize, maxOutputTokens, memorySummary, promptAdherence }: CompletionParams): AsyncGenerator<string> {
  if (!model?.trim()) {
    throw new Error(`Model name for ${provider} is not configured. Please set it in API Settings.`);
  }

  let finalSystemPrompt = globalSystemPrompt;

  if (userPersona) {
    finalSystemPrompt += `\n\nYOU ARE ROLEPLAYING WITH THE FOLLOWING PERSONA:\nName: ${userPersona.name}\nDescription: ${userPersona.description}`;
  }

  if (memorySummary) {
      finalSystemPrompt += `\n\nLONG-TERM MEMORY SUMMARY:\nThis is a summary of the conversation so far. Use it to maintain context and continuity.\n---\n${memorySummary}\n---`;
  }

  // --- Linked Lore Discovery (RAG V2) ---
  const MAX_LORE_ENTRIES = 7;
  let worldEntries: WorldEntry[] = [];

  // Backward compatibility for old world format
  if (world) {
      if (world.entries && world.entries.length > 0) {
          worldEntries = world.entries;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } else if ((world as any).content) {
          worldEntries = [{
              id: 'legacy-content',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content: (world as any).content,
              keys: [world.name.toLowerCase(), 'general'],
              enabled: true,
              isAlwaysActive: true,
          }];
      }
  }

  if (worldEntries.length > 0) {
      const allEnabledEntries = worldEntries.filter(e => e.enabled && e.keys.length > 0);
      if (allEnabledEntries.length > 0) {
          const activeEntries = new Set<WorldEntry>();
          const discoveryQueue: WorldEntry[] = [];

          const addEntryToQueue = (entry: WorldEntry) => {
              if (!activeEntries.has(entry) && activeEntries.size < MAX_LORE_ENTRIES) {
                  activeEntries.add(entry);
                  discoveryQueue.push(entry);
              }
          };

          // 1. Seed with "Always Active" entries
          allEnabledEntries.forEach(entry => {
              if (entry.isAlwaysActive) {
                  addEntryToQueue(entry);
              }
          });

          // 2. Seed with entries from chat context
          const recentMessagesContent = messages.slice(-3).map(m => m.content).join(' \n ').toLowerCase();
          allEnabledEntries.forEach(entry => {
              for (const key of entry.keys) {
                  const regex = new RegExp(`\\b${key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
                  if (recentMessagesContent.match(regex)) {
                      addEntryToQueue(entry);
                      break;
                  }
              }
          });

          // 3. Process queue for linked entries (Breadth-First Search)
          let i = 0;
          while (i < discoveryQueue.length && activeEntries.size < MAX_LORE_ENTRIES) {
              const entryToScan = discoveryQueue[i];
              i++;
              const entryContent = entryToScan.content.toLowerCase();
              
              allEnabledEntries.forEach(potentialLink => {
                  if (activeEntries.has(potentialLink)) return;
                  
                  for (const key of potentialLink.keys) {
                      if (key.trim().length < 3) continue;
                      const regex = new RegExp(`\\b${key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
                      if (entryContent.match(regex)) {
                          addEntryToQueue(potentialLink);
                          break;
                      }
                  }
              });
          }

          if (activeEntries.size > 0) {
              const finalEntries = Array.from(activeEntries);
              const lorebookPreamble = `\n\nALWAYS CONSULT THE FOLLOWING RELEVANT LOREBOOK ENTRIES FOR CONTEXT AND CONSISTENCY:\n`;
              const lorebookContent = finalEntries.map(entry =>
                  `--- Entry (Keywords: ${entry.keys.join(', ')}) ---\n${entry.content}`
              ).join('\n\n');
              finalSystemPrompt += `${lorebookPreamble}${lorebookContent}`;
              logger.log('Injected linked lore entries', {
                  count: finalEntries.length,
                  world: world?.name,
                  entryKeys: finalEntries.map(e => e.keys[0] || e.id),
              });
          }
      }
  }

  finalSystemPrompt += `\n\nYOUR ROLE IN THIS SCENE:\n${characterPersona}`;

  if (thinkingEnabled) {
    finalSystemPrompt += `\n\nTHINKING INSTRUCTIONS:\nAfter your complete roleplay response, you MUST include the separator token \`<|THINKING|>\`. After this token, provide a brief, out-of-character explanation for your creative choices. This thinking process should analyze the user's prompt, your character's persona, and the narrative goals to justify the content, tone, and direction of your reply.`;
  }
  
  if (promptAdherence === 'strict') {
    finalSystemPrompt += `\n\n**CRITICAL REMINDER OF YOUR CORE DIRECTIVES:**\n${CRITICAL_RULES_PROMPT}`;
  }

  // Token Management - Truncate messages to fit context window
  const availableTokensForHistory = contextSize;
  
  const truncatedMessages: Message[] = [];
  let usedTokens = 0;

  // Iterate backwards through messages to keep the most recent ones
  for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageTokens = estimateTokens(message.content);
      if (usedTokens + messageTokens > availableTokensForHistory) {
          logger.log(`Context limit reached. Truncating messages.`, { availableTokens: availableTokensForHistory, usedTokens, totalMessages: messages.length, messagesKept: truncatedMessages.length });
          break;
      }
      truncatedMessages.unshift(message); // Add to the beginning of the array
      usedTokens += messageTokens;
  }

  const apiMessages = truncatedMessages.filter(m => m.role !== 'system');
  
  // Now call the appropriate stream generator based on provider.
  if (provider === LLMProvider.GEMINI) {
      yield* getGeminiCompletionStream(apiKey, apiMessages, finalSystemPrompt, model, temperature, maxOutputTokens, prefill, signal);
  } else if (provider === LLMProvider.OPENROUTER || provider === LLMProvider.DEEPSEEK) {
      yield* getOpenAICompatibleCompletionStream(provider, apiKey, apiMessages, finalSystemPrompt, model, temperature, maxOutputTokens, prefill, signal);
  } else {
      logger.error(`Unsupported provider in getChatCompletionStream: ${provider}`);
      throw new Error(`Unsupported provider: ${provider}`);
  }
}