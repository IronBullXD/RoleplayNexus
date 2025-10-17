import { GoogleGenAI, Type } from '@google/genai';
import { World, ContentSuggestion, LLMProvider } from '../types';
import { logger } from './logger';
import { ERROR_MESSAGES } from './errorMessages';

// Instantiate the Gemini client once at the module level.
const geminiAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface SuggestionParams {
  world: World;
  provider: LLMProvider;
  apiKey: string;
  model: string;
}

export async function generateContentSuggestions({
  world,
  provider,
  apiKey,
  model,
}: SuggestionParams): Promise<ContentSuggestion[]> {
  if (provider !== LLMProvider.GEMINI) {
    // For now, only implement for Gemini as it's the most capable with JSON schemas.
    // This could be expanded to other providers later.
    logger.log('Content suggestion is currently only supported for Gemini provider.');
    return [{
        type: 'expansion',
        message: `Content suggestions are currently only available for the Gemini provider.`,
        entryIds: []
    }];
  }
  
  const systemPrompt = `You are an expert world-building editor and narrative designer. Your task is to analyze a collection of lore entries for a fictional world and provide actionable suggestions to improve its depth, consistency, and completeness.

You will identify four types of issues:
1.  **incomplete_entry**: An entry that is too short, lacks detail, or feels like a placeholder. Suggest specific details that could be added.
2.  **missing_keyword**: A piece of text mentions a concept or name that is a keyword for another entry, but that other entry is not linked. Point this out.
3.  **expansion**: An opportunity to add a new related entry or expand on an existing concept to flesh out the world. Suggest a new entry name and concept.
4.  **contradiction**: Logical inconsistencies or direct contradictions between entries. (This is similar to validation, but you can be more nuanced and find subtle issues).

CRITICAL INSTRUCTIONS:
- Read all provided lore entries carefully. Each has a unique ID.
- Your response MUST be a valid JSON array of suggestion objects.
- For each suggestion, provide the type, a concise descriptive message, and the IDs of the relevant entries.
- For 'missing_keyword' suggestions, you MUST include the keyword to add in the 'relatedData.keywordToAdd' field.
- Do not suggest more than 5-7 high-quality improvements. Focus on the most impactful suggestions.
- If the world is already excellent and you can't find any issues, return an empty array.
`;

  const worldContent = world.entries
    .filter(e => e.enabled && (e.content || e.keys?.length))
    .map(entry => `--- Entry ID: ${entry.id}, Name: ${entry.name || 'Unnamed'} ---\nKeywords: ${(entry.keys || []).join(', ')}\nContent: ${entry.content || 'N/A'}`)
    .join('\n\n');

  if (!worldContent) {
    return []; // No content to analyze
  }

  const userPrompt = `Here are the lore entries for the world of "${world.name}". Please analyze them and provide improvement suggestions.\n\n${worldContent}`;

  const requestData = { provider, model, worldName: world.name };
  logger.apiRequest('Generating world content suggestions', requestData);

  try {
    const response = await geminiAI.models.generateContent({
      model: model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.5,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                enum: ['missing_keyword', 'incomplete_entry', 'contradiction', 'expansion'],
              },
              message: {
                type: Type.STRING,
                description: "A clear and concise message explaining the suggestion to the user.",
              },
              entryIds: {
                type: Type.ARRAY,
                description: "An array of the string IDs of the relevant entries.",
                items: { type: Type.STRING },
              },
              relatedData: {
                type: Type.OBJECT,
                description: "Optional data for actionable suggestions.",
                properties: {
                    keywordToAdd: {
                        type: Type.STRING,
                        description: "The keyword that should be added. Only for 'missing_keyword' type."
                    }
                }
              },
            },
            required: ["type", "message", "entryIds"],
          },
        },
      },
    });

    const jsonStr = response.text.trim();
    const suggestions = JSON.parse(jsonStr) as ContentSuggestion[];
    logger.apiResponse('Content suggestions generated successfully', { response: suggestions });
    return suggestions;
  } catch (error) {
    logger.error('Content suggestion generation failed', { error, requestData });
    const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR;
    // Return an error as a suggestion so it's displayed to the user
    return [{
        type: 'expansion', // A neutral type
        message: `AI analysis failed: ${errorMessage}`,
        entryIds: []
    }];
  }
}
