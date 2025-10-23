import { GoogleGenAI, Type } from '@google/genai';
import { Message, ThinkingDepth, ThinkingStep, LLMProvider, Persona, World, Settings } from '../types';
import { getChatCompletionStream } from './llmService';
import { logger } from './logger';
import { useUIStore } from '../store/stores/uiStore';

const geminiAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

type GetCompletionParams = Parameters<typeof getChatCompletionStream>[0];

interface ThinkingParams extends GetCompletionParams {
  depth: ThinkingDepth;
  timeout: number;
}

interface ThinkingResult {
    analysis: string;
    plan: string;
    reasoning?: string;
}

async function runThinkingStep<T>(
  prompt: string,
  systemInstruction: string,
  model: string,
  timeout: number,
  responseSchema: any
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Thinking step timed out')), timeout)
  );

  const apiCall = geminiAI.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.3,
      responseMimeType: 'application/json',
      responseSchema,
    },
  });

  const response = await Promise.race([apiCall, timeoutPromise]);
  
  const text = response.text;
  if (!text || text.trim() === '') {
      logger.error('Thinking step received empty or invalid response from Gemini.', { response });
      if (response.promptFeedback && response.promptFeedback.blockReason) {
        throw new Error(`AI response blocked. Reason: ${response.promptFeedback.blockReason}.`);
      }
      throw new Error('Received an empty response from the AI during a thinking step.');
  }

  return JSON.parse(text.trim()) as T;
}

export async function* generateResponseWithThinking(
  params: GetCompletionParams
): AsyncGenerator<{ type: 'step' | 'chunk' | 'start_response'; payload: ThinkingStep | string }> {
  const thinkingParams: ThinkingParams = {
    ...params,
    depth: params.settings.thinkingDepth,
    timeout: params.settings.thinkingTimeout,
  };

  const fallback = async function* () {
    logger.log('Falling back to direct generation.');
    const stream = getChatCompletionStream(params);
    for await (const chunk of stream) {
        yield { type: 'chunk' as const, payload: chunk };
    }
  };

  try {
    const thinkingResult: ThinkingResult = { analysis: '', plan: '' };
    const context = `
        Conversation History (last 5 messages):
        ${params.messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

        Character Persona:
        ${params.characterPersona}
    `;

    // Step 1: Analysis
    if (thinkingParams.depth === ThinkingDepth.MEDIUM || thinkingParams.depth === ThinkingDepth.DEEP) {
        const analysisSystem = 'You are a story analysis engine. Analyze the context and last message. Identify themes, user intent, character emotions, and potential plot points. Respond ONLY with a valid JSON object.';
        const analysisResult = await runThinkingStep<{ analysis: string }>(
            context, analysisSystem, thinkingParams.model, thinkingParams.timeout,
            { type: Type.OBJECT, properties: { analysis: { type: Type.STRING } }, required: ['analysis'] }
        );
        thinkingResult.analysis = analysisResult.analysis;
        yield { type: 'step', payload: { title: 'Context Analysis', content: thinkingResult.analysis } };
    }
    
    // Step 2: Planning
    const planSystem = 'You are a response planner. Based on the context and analysis, create a concise, step-by-step plan for the character\'s response. Respond ONLY with a valid JSON object.';
    const planResult = await runThinkingStep<{ plan: string }>(
        `${context}\n\nAnalysis:\n${thinkingResult.analysis}`,
        planSystem, thinkingParams.model, thinkingParams.timeout,
        { type: Type.OBJECT, properties: { plan: { type: Type.STRING } }, required: ['plan'] }
    );
    thinkingResult.plan = planResult.plan;
    yield { type: 'step', payload: { title: 'Response Plan', content: thinkingResult.plan } };

    // Step 3: Reasoning
    if (thinkingParams.depth === ThinkingDepth.DEEP) {
        const reasoningSystem = 'You are the character. Think through your internal monologue, motivations, and conflicts regarding the situation and your planned response. This is your inner voice. Respond ONLY with a valid JSON object.';
        const reasoningResult = await runThinkingStep<{ reasoning: string }>(
            `${context}\n\nAnalysis:\n${thinkingResult.analysis}\n\nPlan:\n${thinkingResult.plan}`,
            reasoningSystem, thinkingParams.model, thinkingParams.timeout,
            { type: Type.OBJECT, properties: { reasoning: { type: Type.STRING } }, required: ['reasoning'] }
        );
        thinkingResult.reasoning = reasoningResult.reasoning;
        yield { type: 'step', payload: { title: 'Character Reasoning', content: thinkingResult.reasoning } };
    }

    // Step 4: Final Generation
    const thinkingContext = `
      ### THINKING CONTEXT ###
      You have analyzed the situation and formulated a plan. Use this context to inform your response, but DO NOT mention the analysis, plan, or reasoning in your final output.
      - **Analysis:** ${thinkingResult.analysis}
      - **Plan:** ${thinkingResult.plan}
      ${thinkingResult.reasoning ? `- **Internal Monologue:** ${thinkingResult.reasoning}` : ''}
    `;
    
    // Prepend thinking context to system prompt for final generation
    const finalParams = { ...params };
    const originalSystem = finalParams.messages.find(m => m.role === 'system');
    if (originalSystem) {
      originalSystem.content = `${thinkingContext}\n\n${originalSystem.content}`;
    } else {
      finalParams.messages.unshift({ id: 'thinking-prompt', role: 'system', content: thinkingContext });
    }

    yield { type: 'start_response', payload: '' };

    const finalStream = getChatCompletionStream(finalParams);
    for await (const chunk of finalStream) {
        yield { type: 'chunk', payload: chunk };
    }

  } catch (error) {
    logger.error('Thinking process failed.', { error });
    useUIStore.getState().setError(`Thinking process failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    yield* fallback();
  }
}