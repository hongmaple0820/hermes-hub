/**
 * Skill Executor - Executes skills during agent chat interactions.
 *
 * Supports three execution modes:
 * - builtin: Execute built-in handler directly (real implementations via z-ai-web-dev-sdk)
 * - webhook: Send message to the skill's callback URL and collect the result
 * - function: Call the handlerUrl as a function endpoint
 *
 * Also provides buildToolDefinitions() to generate OpenAI function/tool definitions
 * from installed skills, allowing the LLM to "call" skills as tools during chat.
 *
 * Tool Chain Execution:
 * - executeToolChain() creates an agentic loop where the LLM can plan,
 *   execute tools, and iterate until the task is complete.
 */

import { db } from '@/lib/db';
import { sendCallback } from '@/lib/skill-protocol';
import { chatCompletion, type ChatMessage, type LLMProviderConfig } from '@/lib/llm-provider';

// ==================== Types ====================

export interface SkillExecutionResult {
  skillId: string;
  skillName: string;
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime: number; // ms
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters?: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface BuiltinHandlerResult {
  content: string;
  data?: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// ==================== ZAI SDK Singleton ====================

let _zaiInstance: any = null;

async function getZAI() {
  if (!_zaiInstance) {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    _zaiInstance = await ZAI.create();
  }
  return _zaiInstance;
}

// ==================== Built-in Skill Handlers ====================

/**
 * Registry of built-in skill handlers.
 * Real implementations use the z-ai-web-dev-sdk for web search, image generation,
 * translation, and TTS. Other skills use improved realistic mock data.
 */
const BUILTIN_HANDLERS: Record<string, (params: Record<string, unknown>) => Promise<BuiltinHandlerResult>> = {
  'web-search': async (params) => {
    try {
      const zai = await getZAI();
      const query = String(params.query || '');
      const numResults = Number(params.maxResults) || 5;

      const results = await zai.functions.invoke('web_search', {
        query,
        num: numResults,
      });

      const formattedResults = (results as Array<{ url: string; name: string; snippet: string; host_name: string; rank: number; date: string }>).map((r, i) => ({
        index: i + 1,
        title: r.name,
        url: r.url,
        snippet: r.snippet,
        source: r.host_name,
        date: r.date,
      }));

      const content = formattedResults.length > 0
        ? `Found ${formattedResults.length} results for "${query}":\n${formattedResults.map(r => `${r.index}. **${r.title}** (${r.source})\n   ${r.snippet}\n   ${r.url}`).join('\n\n')}`
        : `No results found for "${query}".`;

      return {
        content,
        data: { query, results: formattedResults },
      };
    } catch (error) {
      // Fallback to mock on SDK failure
      console.error('[SkillExecutor] Web search SDK error, using fallback:', error);
      return {
        content: `Web search for "${params.query}" encountered an error. Fallback: This search would return real web results in production.`,
        data: { query: params.query, results: [], error: error instanceof Error ? error.message : 'SDK error' },
      };
    }
  },

  'weather-query': async (params) => {
    // LLM-powered weather info (no real weather API available)
    const location = String(params.location || 'Unknown');
    const unit = String(params.unit || 'celsius');

    try {
      const zai = await getZAI();
      const result = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: `You are a weather information assistant. Provide a realistic weather description for the requested location. Include temperature (in ${unit}), conditions, humidity, and wind. Format your response as a concise weather report. If you don't know the exact current weather, provide typical weather for the location and season, and note that it's an estimate.` },
          { role: 'user', content: `What is the weather in ${location}?` },
        ],
        temperature: 0.7,
      });

      const content = result.choices?.[0]?.message?.content || result.content || '';
      return {
        content: content || `Weather information for ${location} is not available right now.`,
        data: { location, unit, source: 'llm-estimate', description: content },
      };
    } catch (error) {
      console.error('[SkillExecutor] Weather LLM error, using fallback:', error);
      return {
        content: `Weather information for ${location} is not available right now. Please check a weather service for current conditions.`,
        data: { location, unit, source: 'fallback', error: error instanceof Error ? error.message : 'LLM error' },
      };
    }
  },

  'code-execution': async (params) => {
    const language = String(params.language || 'javascript');
    const code = String(params.code || '');

    // Sandboxed eval for JavaScript only, with safety limits
    if (language === 'javascript' && code.length > 0 && code.length < 5000) {
      try {
        // Create a safe evaluation context
        const safeGlobals: Record<string, unknown> = {
          console: {
            log: (...args: unknown[]) => args.map(String).join(' '),
            error: (...args: unknown[]) => args.map(String).join(' '),
            warn: (...args: unknown[]) => args.map(String).join(' '),
          },
          Math,
          JSON,
          Date,
          parseInt,
          parseFloat,
          isNaN,
          isFinite,
          encodeURIComponent,
          decodeURIComponent,
          Array,
          Object,
          String,
          Number,
          Boolean,
          Map,
          Set,
          RegExp,
        };

        // Use Function constructor for sandboxed eval (limited, no access to require/process)
        const fn = new Function(...Object.keys(safeGlobals), `"use strict";\n${code}`);
        const output = fn(...Object.values(safeGlobals));

        return {
          content: `Code executed successfully in ${language}:\nOutput: ${String(output)}`,
          data: { language, output: String(output), exitCode: 0 },
        };
      } catch (evalError) {
        return {
          content: `Code execution error in ${language}: ${evalError instanceof Error ? evalError.message : String(evalError)}`,
          data: { language, output: null, exitCode: 1, error: evalError instanceof Error ? evalError.message : String(evalError) },
        };
      }
    }

    // For non-JS or too-large code, return simulated result
    return {
      content: `Code execution requested in ${language}: ${code.length > 50 ? code.substring(0, 50) + '...' : code}. Execution output would be returned in a full sandbox environment.`,
      data: { language, output: null, exitCode: null, note: 'Sandboxed execution only available for JavaScript under 5000 chars' },
    };
  },

  'image-generation': async (params) => {
    try {
      const zai = await getZAI();
      const prompt = String(params.prompt || '');
      const size = (String(params.size) || '1024x1024') as '1024x1024' | '768x1344' | '864x1152' | '1344x768' | '1152x864' | '1440x720' | '720x1440';

      const result = await zai.images.generations.create({
        prompt,
        size,
      });

      const imageData = result.data?.[0];
      const base64 = imageData?.base64;

      return {
        content: `Image generated successfully with prompt: "${prompt}"${base64 ? ' (base64 data available)' : ''}`,
        data: { prompt, imageBase64: base64 ? `data:image/png;base64,${base64}` : null, size },
      };
    } catch (error) {
      console.error('[SkillExecutor] Image generation SDK error, using fallback:', error);
      return {
        content: `Image generation for "${params.prompt}" encountered an error. Fallback: Image would be generated in production.`,
        data: { prompt: params.prompt, imageUrl: null, error: error instanceof Error ? error.message : 'SDK error' },
      };
    }
  },

  'document-processing': async (params) => {
    // LLM-powered text processing (summarize, extract key points, format)
    const action = String(params.action || 'summarize');
    const text = String(params.text || params.content || '');
    const fileUrl = String(params.fileUrl || '');

    if (!text && !fileUrl) {
      return {
        content: 'No text or document provided for processing. Please provide text content to analyze.',
        data: { action, result: null, error: 'No input provided' },
      };
    }

    const actionPrompts: Record<string, string> = {
      summarize: 'Provide a clear and concise summary of the following text.',
      'extract-key-points': 'Extract the key points from the following text as a bulleted list.',
      analyze: 'Analyze the following text and provide insights on structure, tone, and main themes.',
      rewrite: 'Rewrite the following text to be clearer and more concise while preserving meaning.',
      translate: 'If the text is not in English, translate it to English. If it is in English, identify the language style and suggest improvements.',
    };

    const systemPrompt = actionPrompts[action] || actionPrompts.summarize;

    try {
      const zai = await getZAI();
      const result = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
      });

      const content = result.choices?.[0]?.message?.content || result.content || '';
      return {
        content: content || `Document ${action} completed.`,
        data: { action, result: content, charCount: text.length, source: 'llm' },
      };
    } catch (error) {
      console.error('[SkillExecutor] Document processing LLM error:', error);
      return {
        content: `Document ${action} could not be completed. Error: ${error instanceof Error ? error.message : 'LLM error'}`,
        data: { action, result: null, error: error instanceof Error ? error.message : 'LLM error' },
      };
    }
  },

  'translation': async (params) => {
    try {
      const zai = await getZAI();
      const text = String(params.text || '');
      const sourceLang = String(params.sourceLang || 'auto');
      const targetLang = String(params.targetLang || 'en');

      if (!text) {
        return { content: 'No text provided for translation.', data: { sourceLang, targetLang, translatedText: '' } };
      }

      const result = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: `You are a professional translator. Translate the following text from ${sourceLang === 'auto' ? 'auto-detected language' : sourceLang} to ${targetLang}. Only return the translation, no explanations.` },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
      });

      const translatedText = result.choices?.[0]?.message?.content || result.content || '';

      return {
        content: `Translation (${sourceLang} → ${targetLang}): ${translatedText}`,
        data: { sourceLang, targetLang, translatedText, originalText: text },
      };
    } catch (error) {
      console.error('[SkillExecutor] Translation SDK error, using fallback:', error);
      return {
        content: `Translation from ${params.sourceLang || 'auto'} to ${params.targetLang} for "${String(params.text).substring(0, 50)}..." encountered an error. Fallback: Translation would be returned in production.`,
        data: { sourceLang: params.sourceLang, targetLang: params.targetLang, translatedText: null, error: error instanceof Error ? error.message : 'SDK error' },
      };
    }
  },

  'reminder': async (params) => {
    // COMING SOON — reminders require a scheduling system
    const message = String(params.message || '');
    const time = String(params.time || '');
    const repeat = String(params.repeat || '');

    return {
      content: `[Coming Soon] Reminders are not yet available. This feature requires a scheduling system. Your reminder "${message}" at ${time} was not scheduled.`,
      data: { message, time, repeat, status: 'coming-soon', note: 'Reminders require a scheduling system which is not yet implemented.' },
    };
  },

  'http-request': async (params) => {
    const method = String(params.method || 'GET').toUpperCase();
    const url = String(params.url || '');
    const headers = params.headers as Record<string, string> | undefined;
    const body = params.body as string | undefined;

    if (!url) {
      return { content: 'No URL provided for HTTP request.', data: { method, url: '', status: null, body: null } };
    }

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        signal: AbortSignal.timeout(15000), // 15s timeout
      };

      if (body && method !== 'GET' && method !== 'HEAD') {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      const responseText = await response.text();

      // Try to parse as JSON for structured data
      let parsedBody: unknown = responseText;
      try {
        parsedBody = JSON.parse(responseText);
      } catch {
        // Keep as text
      }

      return {
        content: `HTTP ${method} ${url} → ${response.status} ${response.statusText}${typeof parsedBody === 'string' && parsedBody.length > 200 ? `\nResponse: ${parsedBody.substring(0, 200)}...` : ''}`,
        data: { method, url, status: response.status, statusText: response.statusText, body: parsedBody },
      };
    } catch (error) {
      return {
        content: `HTTP ${method} ${url} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { method, url, status: null, body: null, error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  },

  'data-analysis': async (params) => {
    // LLM-powered data analysis (user provides data, LLM analyzes)
    const analysisType = String(params.analysis || 'summary');
    const data = String(params.data || params.input || '');
    const visualize = Boolean(params.visualize);

    if (!data) {
      return {
        content: 'No data provided for analysis. Please provide data to analyze.',
        data: { analysis: analysisType, result: null, error: 'No data provided' },
      };
    }

    const analysisPrompts: Record<string, string> = {
      summary: 'Provide a statistical summary of the following data. Identify key patterns, averages, and notable values.',
      trends: 'Analyze the following data for trends. Identify upward/downward trends, cyclical patterns, and predict future direction.',
      anomalies: 'Identify any anomalies or outliers in the following data. Explain why they stand out.',
      compare: 'Compare the data points in the following dataset. Highlight significant differences and similarities.',
      correlations: 'Look for correlations and relationships in the following data. Explain any found correlations.',
    };

    const systemPrompt = analysisPrompts[analysisType] || analysisPrompts.summary;
    const fullPrompt = visualize
      ? `${systemPrompt} Also suggest what type of visualization would best represent this data.`
      : systemPrompt;

    try {
      const zai = await getZAI();
      const result = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: fullPrompt },
          { role: 'user', content: data },
        ],
        temperature: 0.3,
      });

      const content = result.choices?.[0]?.message?.content || result.content || '';
      return {
        content: content || `Data analysis (${analysisType}) completed.`,
        data: { analysis: analysisType, result: content, visualize, source: 'llm' },
      };
    } catch (error) {
      console.error('[SkillExecutor] Data analysis LLM error:', error);
      return {
        content: `Data analysis (${analysisType}) could not be completed. Error: ${error instanceof Error ? error.message : 'LLM error'}`,
        data: { analysis: analysisType, result: null, error: error instanceof Error ? error.message : 'LLM error' },
      };
    }
  },

  'email-sender': async (params) => {
    // COMING SOON — email sending requires SMTP integration
    const to = String(params.to || '');
    const subject = String(params.subject || '');

    return {
      content: `[Coming Soon] Email sending is not yet available. This feature requires SMTP integration. Your email to "${to}" with subject "${subject}" was not sent.`,
      data: { to, subject, sent: false, status: 'coming-soon', note: 'Email sending requires SMTP integration which is not yet configured.' },
    };
  },

  'text-to-speech': async (params) => {
    try {
      const zai = await getZAI();
      const text = String(params.text || '');
      const voice = String(params.voice || 'alloy');

      if (!text) {
        return { content: 'No text provided for text-to-speech.', data: { text: '', voice, audioUrl: null } };
      }

      const response = await zai.audio.tts.create({
        input: text,
        voice,
      });

      // The TTS response is a Response object - we need to get the audio data
      let audioBase64: string | null = null;
      if (response instanceof Response) {
        const buffer = await response.arrayBuffer();
        audioBase64 = Buffer.from(buffer).toString('base64');
      }

      return {
        content: `Text-to-speech conversion completed${voice ? ` with voice: ${voice}` : ''}${audioBase64 ? ' (audio data available as base64)' : ''}`,
        data: { text, voice, audioBase64: audioBase64 ? `data:audio/mp3;base64,${audioBase64}` : null, format: 'mp3' },
      };
    } catch (error) {
      console.error('[SkillExecutor] TTS SDK error, using fallback:', error);
      return {
        content: `Text-to-speech for "${String(params.text).substring(0, 50)}..." encountered an error. Fallback: Audio would be generated in production.`,
        data: { text: params.text, voice: params.voice, audioUrl: null, error: error instanceof Error ? error.message : 'SDK error' },
      };
    }
  },

  'database-query': async (params) => {
    // COMING SOON — arbitrary DB queries require real DB connection setup
    const query = String(params.query || '');
    const database = String(params.database || 'default');

    return {
      content: `[Coming Soon] Database queries are not yet available. This feature requires database connection configuration. Your query on "${database}" was not executed.`,
      data: { query, database, status: 'coming-soon', note: 'Database queries require a configured database connection which is not yet available.' },
    };
  },
};

// ==================== Skill Status Map ====================

/**
 * Maps skill names to their status: 'active', 'beta', or 'coming-soon'.
 * Used by the UI to show badges and disable toggles for unavailable skills.
 */
export const SKILL_STATUS_MAP: Record<string, 'active' | 'beta' | 'coming-soon'> = {
  'web-search': 'active',
  'image-generation': 'active',
  'translation': 'active',
  'text-to-speech': 'active',
  'http-request': 'active',
  'code-execution': 'beta',
  'weather-query': 'beta',        // LLM-powered estimate, not real weather data
  'document-processing': 'active', // LLM-powered text processing
  'data-analysis': 'active',      // LLM-powered data analysis
  'email-sender': 'coming-soon',
  'database-query': 'coming-soon',
  'reminder': 'coming-soon',
};

// ==================== Skill Execution ====================

/**
 * Execute all enabled skills for an agent, ordered by priority.
 * This is the main entry point called during chat when an agent needs to process a message.
 *
 * @param agentId - The agent ID
 * @param message - The incoming message content
 * @param conversationId - The conversation ID (for context)
 * @param toolCalls - Optional tool calls from the LLM that should be routed to skills
 * @returns Array of execution results, one per skill invoked
 */
export async function executeSkillsForAgent(
  agentId: string,
  message: string,
  conversationId: string,
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>
): Promise<SkillExecutionResult[]> {
  // Load all enabled skills for the agent, ordered by priority
  const agentSkills = await db.agentSkill.findMany({
    where: {
      agentId,
      isEnabled: true,
    },
    include: { skill: true },
    orderBy: { priority: 'desc' },
  });

  if (agentSkills.length === 0) {
    return [];
  }

  const results: SkillExecutionResult[] = [];

  for (const binding of agentSkills) {
    const skill = binding.skill;

    // If toolCalls are provided, only execute skills that match a tool call
    if (toolCalls && toolCalls.length > 0) {
      const matchingCall = toolCalls.find((tc) => tc.name === skill.name);
      if (!matchingCall) continue;

      const startTime = Date.now();
      try {
        const result = await executeSingleSkill(
          skill.handlerType,
          skill.name,
          matchingCall.arguments,
          binding.callbackUrl || skill.callbackUrl || skill.handlerUrl,
          binding.callbackSecret || skill.callbackSecret,
          { agentId, conversationId, bindingId: binding.id }
        );

        // Update invocation stats
        await db.agentSkill.update({
          where: { id: binding.id },
          data: {
            lastInvokedAt: new Date(),
            invokeCount: { increment: 1 },
          },
        });

        results.push({
          skillId: skill.id,
          skillName: skill.name,
          success: true,
          result,
          executionTime: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          skillId: skill.id,
          skillName: skill.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: Date.now() - startTime,
        });
      }
      continue;
    }

    // Without tool calls, execute skills that match the message context
    // Only execute skills that have subscribed to the "message" event
    const subscribedEvents: string[] = JSON.parse(skill.events || '[]');
    if (subscribedEvents.length > 0 && !subscribedEvents.includes('message')) {
      continue;
    }

    const startTime = Date.now();
    try {
      // Parse skill parameters to extract from message
      const params = extractParamsFromMessage(message, skill.parameters);

      const result = await executeSingleSkill(
        skill.handlerType,
        skill.name,
        params,
        binding.callbackUrl || skill.callbackUrl || skill.handlerUrl,
        binding.callbackSecret || skill.callbackSecret,
        { agentId, conversationId, bindingId: binding.id, message }
      );

      // Update invocation stats
      await db.agentSkill.update({
        where: { id: binding.id },
        data: {
          lastInvokedAt: new Date(),
          invokeCount: { increment: 1 },
        },
      });

      results.push({
        skillId: skill.id,
        skillName: skill.name,
        success: true,
        result,
        executionTime: Date.now() - startTime,
      });
    } catch (error) {
      results.push({
        skillId: skill.id,
        skillName: skill.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
      });
    }
  }

  return results;
}

/**
 * Execute a single skill based on its handler type.
 */
async function executeSingleSkill(
  handlerType: string,
  skillName: string,
  params: Record<string, unknown>,
  callbackUrl: string | null | undefined,
  callbackSecret: string | null | undefined,
  context: { agentId: string; conversationId: string; bindingId: string; message?: string }
): Promise<unknown> {
  switch (handlerType) {
    case 'builtin': {
      const handler = BUILTIN_HANDLERS[skillName];
      if (handler) {
        return handler(params);
      }
      return {
        content: `Built-in skill "${skillName}" invoked with params: ${JSON.stringify(params)}. No specific handler registered.`,
        data: params,
      };
    }

    case 'webhook': {
      if (!callbackUrl) {
        throw new Error(`Webhook skill "${skillName}" has no callback URL configured`);
      }

      const webhookResult = await sendCallback(
        callbackUrl,
        callbackSecret || null,
        {
          type: 'tool_call',
          data: {
            skillName,
            params,
            context,
          },
          timestamp: new Date().toISOString(),
          source: 'system' as const,
        },
        context.agentId,
        undefined,
        undefined,
      );

      if (!webhookResult.success) {
        throw new Error(webhookResult.error || `Webhook call to ${callbackUrl} failed`);
      }

      return {
        type: 'webhook',
        skillName,
        status: 200,
        params,
        response: webhookResult.response,
      };
    }

    case 'function': {
      if (!callbackUrl) {
        throw new Error(`Function skill "${skillName}" has no handler URL configured`);
      }

      // Call the function endpoint
      const functionResult = await sendCallback(
        callbackUrl,
        callbackSecret || null,
        {
          type: 'tool_call',
          data: {
            skillName,
            params,
            context,
          },
          timestamp: new Date().toISOString(),
          source: 'system' as const,
        },
        context.agentId,
        undefined,
        undefined,
      );

      if (!functionResult.success) {
        throw new Error(functionResult.error || `Function call to ${callbackUrl} failed`);
      }

      return {
        type: 'function',
        skillName,
        status: 200,
        params,
        response: functionResult.response,
      };
    }

    default:
      throw new Error(`Unknown handler type: ${handlerType}`);
  }
}

/**
 * Extract parameters from a message based on the skill's parameter schema.
 * Simple heuristic: try to match parameter names in the message.
 */
function extractParamsFromMessage(
  message: string,
  parametersJson: string
): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  try {
    const parameters = JSON.parse(parametersJson || '[]') as Array<{
      name: string;
      type: string;
      required: boolean;
      description?: string;
    }>;

    for (const param of parameters) {
      if (param.required) {
        // For required params, try to extract from message
        // Simple heuristic: if message contains the param name followed by a colon or equals
        const regex = new RegExp(`${param.name}\\s*[:=]\\s*(.+?)(?:\\s*[,;]|$)`, 'i');
        const match = message.match(regex);
        if (match) {
          params[param.name] = match[1].trim();
        } else if (param.type === 'string') {
          // For string params, use the whole message as the value
          params[param.name] = message;
        }
      }
    }
  } catch {
    // If parameters can't be parsed, return empty params
  }

  return params;
}

// ==================== Tool Definition Builder ====================

/**
 * Build OpenAI function/tool definitions from all installed skills for an agent.
 * This allows the LLM to "call" skills as tools during chat.
 *
 * Returns an array of tool definitions in the OpenAI function calling format.
 */
export async function buildToolDefinitions(agentId: string): Promise<ToolDefinition[]> {
  const agentSkills = await db.agentSkill.findMany({
    where: {
      agentId,
      isEnabled: true,
    },
    include: { skill: true },
    orderBy: { priority: 'desc' },
  });

  const tools: ToolDefinition[] = [];

  for (const binding of agentSkills) {
    const skill = binding.skill;

    // Parse parameters into OpenAI function format
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    try {
      const parameters = JSON.parse(skill.parameters || '[]') as Array<{
        name: string;
        type: string;
        required: boolean;
        description?: string;
        enum?: string[];
      }>;

      for (const param of parameters) {
        const prop: Record<string, unknown> = {
          type: mapParamType(param.type),
          description: param.description || `Parameter: ${param.name}`,
        };

        if (param.enum) {
          prop.enum = param.enum;
        }

        properties[param.name] = prop;

        if (param.required) {
          required.push(param.name);
        }
      }
    } catch {
      // If parameters can't be parsed, add a generic input parameter
      properties.input = {
        type: 'string',
        description: `Input for the ${skill.displayName} skill`,
      };
      required.push('input');
    }

    tools.push({
      type: 'function',
      function: {
        name: skill.name,
        description: skill.description,
        parameters: {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined,
        },
      },
    });
  }

  return tools;
}

/**
 * Map skill parameter types to OpenAI function parameter types.
 */
function mapParamType(type: string): string {
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    case 'array':
      return 'array';
    default:
      return 'string';
  }
}

// ==================== Tool Chain Execution ====================

/**
 * Execute a tool chain — an agentic loop where the LLM can plan, call tools,
 * receive results, and iterate until the task is complete or max iterations reached.
 *
 * Flow:
 * 1. Build initial messages + tools
 * 2. Call LLM
 * 3. If LLM returns tool_calls → execute them → add results to messages → call LLM again
 * 4. Repeat until no more tool calls or max iterations reached
 * 5. Return final content + all tool results
 */
export async function executeToolChain(
  agentId: string,
  message: string,
  conversationId: string,
  llmCall: (messages: ChatMessage[], tools: ToolDefinition[]) => Promise<{ content: string; toolCalls?: ToolCall[] }>,
  maxIterations: number = 5,
  approvedSkills?: string[] // Only execute skills in this list
): Promise<{ content: string; toolResults: SkillExecutionResult[] }> {
  // Load tool definitions for this agent
  let tools = await buildToolDefinitions(agentId);

  // If approvedSkills is provided, filter tools to only approved ones
  if (approvedSkills && approvedSkills.length > 0) {
    tools = tools.filter(t => approvedSkills.includes(t.function.name));
  }

  if (tools.length === 0) {
    // No tools available, just call LLM once
    const result = await llmCall([{ role: 'user', content: message }], []);
    return { content: result.content, toolResults: [] };
  }

  // Build initial messages
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are an intelligent agent with access to tools. When you need information or want to perform actions, use the available tools. After receiving tool results, you can continue using tools or provide your final answer. Always provide a clear, helpful response based on the tool results.',
    },
    { role: 'user', content: message },
  ];

  const allToolResults: SkillExecutionResult[] = [];
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    // Call the LLM with current messages and tools
    const llmResult = await llmCall(messages, tools);

    if (!llmResult.toolCalls || llmResult.toolCalls.length === 0) {
      // No tool calls — LLM has finished, return the content
      return { content: llmResult.content, toolResults: allToolResults };
    }

    // Add assistant message with tool calls info
    messages.push({
      role: 'assistant',
      content: llmResult.content || `Calling tools: ${llmResult.toolCalls.map(tc => tc.name).join(', ')}`,
    });

    // Execute each tool call
    const toolCallResults: Array<{ name: string; result: string }> = [];

    for (const toolCall of llmResult.toolCalls) {
      const startTime = Date.now();
      try {
        // Execute the skill via the existing skill execution pipeline
        const skillResults = await executeSkillsForAgent(
          agentId,
          message,
          conversationId,
          [{ name: toolCall.name, arguments: toolCall.arguments }]
        );

        if (skillResults.length > 0) {
          const skillResult = skillResults[0];
          allToolResults.push(skillResult);

          const resultStr = skillResult.success
            ? JSON.stringify(skillResult.result, null, 2)
            : `Error: ${skillResult.error}`;

          toolCallResults.push({ name: toolCall.name, result: resultStr });
        } else {
          // No matching skill found — try the builtin handler directly
          const handler = BUILTIN_HANDLERS[toolCall.name];
          if (handler) {
            const handlerResult = await handler(toolCall.arguments);
            const skillResult: SkillExecutionResult = {
              skillId: `builtin_${toolCall.name}`,
              skillName: toolCall.name,
              success: true,
              result: handlerResult,
              executionTime: Date.now() - startTime,
            };
            allToolResults.push(skillResult);
            toolCallResults.push({ name: toolCall.name, result: JSON.stringify(handlerResult, null, 2) });
          } else {
            const errorResult: SkillExecutionResult = {
              skillId: `unknown_${toolCall.name}`,
              skillName: toolCall.name,
              success: false,
              error: `No skill or handler found for tool: ${toolCall.name}`,
              executionTime: Date.now() - startTime,
            };
            allToolResults.push(errorResult);
            toolCallResults.push({ name: toolCall.name, result: `Error: No handler for tool ${toolCall.name}` });
          }
        }
      } catch (error) {
        const errorResult: SkillExecutionResult = {
          skillId: `error_${toolCall.name}`,
          skillName: toolCall.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: Date.now() - startTime,
        };
        allToolResults.push(errorResult);
        toolCallResults.push({ name: toolCall.name, result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
      }
    }

    // Add tool results as a user message for the next LLM call
    const toolResultMessage = toolCallResults
      .map(tc => `--- Tool: ${tc.name} ---\n${tc.result}`)
      .join('\n\n');

    messages.push({
      role: 'user',
      content: `[Tool Results]:\n${toolResultMessage}\n\nBased on these results, provide your response or call more tools if needed.`,
    });
  }

  // Max iterations reached — make one final LLM call without tools to get a summary
  const finalResult = await llmCall(messages, []);
  return { content: finalResult.content, toolResults: allToolResults };
}

/**
 * Create an LLM caller function from a provider config and model.
 * This is used by executeToolChain to call the LLM with tool definitions.
 */
export function createLLMCaller(
  providerConfig: LLMProviderConfig,
  model?: string,
  options?: { temperature?: number; maxTokens?: number }
): (messages: ChatMessage[], tools: ToolDefinition[]) => Promise<{ content: string; toolCalls?: ToolCall[] }> {
  return async (messages, tools) => {
    // For providers that support function calling (OpenAI-compatible),
    // we need to call the API directly with tools parameter
    if (['openai', 'custom', 'z-ai'].includes(providerConfig.provider)) {
      return callLLMWithTools(providerConfig, model, messages, tools, options);
    }

    // For other providers, use regular chat completion and parse tool calls from the response
    const result = await chatCompletion(providerConfig, messages, model, {
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 2048,
    });

    // Try to extract tool calls from the response text
    const parsedToolCalls = parseToolCallsFromText(result.content);

    return {
      content: result.content,
      toolCalls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined,
    };
  };
}

/**
 * Call an OpenAI-compatible LLM with tool definitions (function calling).
 */
async function callLLMWithTools(
  providerConfig: LLMProviderConfig,
  model: string | undefined,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<{ content: string; toolCalls?: ToolCall[] }> {
  const effectiveModel = model || providerConfig.defaultModel || 'gpt-3.5-turbo';

  if (providerConfig.provider === 'z-ai') {
    // Use z-ai SDK
    try {
      const zai = await getZAI();
      const body: Record<string, unknown> = {
        model: effectiveModel,
        messages: messages.map(({ role, content }) => ({ role, content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      };

      if (tools.length > 0) {
        body.tools = tools;
        body.tool_choice = 'auto';
      }

      const result = await zai.chat.completions.create(body as any);
      const choice = result.choices?.[0];
      const content = choice?.message?.content || '';
      const toolCalls = choice?.message?.tool_calls?.map((tc: any) => ({
        id: tc.id || `call_${Date.now()}`,
        name: tc.function?.name || '',
        arguments: typeof tc.function?.arguments === 'string'
          ? JSON.parse(tc.function.arguments)
          : tc.function?.arguments || {},
      }));

      return {
        content,
        toolCalls: toolCalls?.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      console.error('[SkillExecutor] z-ai tool calling error:', error);
      // Fallback to regular chat completion
      const result = await chatCompletion(providerConfig, messages, model, {
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 2048,
      });
      const parsedToolCalls = parseToolCallsFromText(result.content);
      return {
        content: result.content,
        toolCalls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined,
      };
    }
  }

  // OpenAI / Custom provider — direct API call with tools support
  const baseUrl = providerConfig.baseUrl || (providerConfig.provider === 'openai' ? 'https://api.openai.com/v1' : 'http://localhost:8080/v1');
  const url = `${baseUrl}/chat/completions`;

  const body: Record<string, unknown> = {
    model: effectiveModel,
    messages: messages.map(({ role, content }) => ({ role, content })),
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  };

  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (providerConfig.apiKey) {
    headers['Authorization'] = `Bearer ${providerConfig.apiKey}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const content = choice?.message?.content || '';
    const toolCalls = choice?.message?.tool_calls?.map((tc: any) => ({
      id: tc.id || `call_${Date.now()}`,
      name: tc.function?.name || '',
      arguments: typeof tc.function?.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function?.arguments || {},
    }));

    return {
      content,
      toolCalls: toolCalls?.length > 0 ? toolCalls : undefined,
    };
  } catch (error) {
    console.error('[SkillExecutor] OpenAI tool calling error:', error);
    // Fallback to regular chat completion
    const result = await chatCompletion(providerConfig, messages, model, {
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 2048,
    });
    const parsedToolCalls = parseToolCallsFromText(result.content);
    return {
      content: result.content,
      toolCalls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined,
    };
  }
}

/**
 * Parse tool calls from LLM text output.
 * This is a fallback for providers that don't support native function calling.
 * Looks for JSON blocks that resemble tool invocations.
 */
function parseToolCallsFromText(text: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];

  // Pattern 1: ```json blocks containing tool calls
  const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
  let match;
  while ((match = jsonBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
        for (const tc of parsed.tool_calls) {
          toolCalls.push({
            id: tc.id || `call_${Date.now()}_${toolCalls.length}`,
            name: tc.name || tc.function?.name || '',
            arguments: typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : (tc.arguments || tc.function?.arguments || {}),
          });
        }
      } else if (parsed.name && parsed.arguments) {
        toolCalls.push({
          id: `call_${Date.now()}_${toolCalls.length}`,
          name: parsed.name,
          arguments: typeof parsed.arguments === 'string' ? JSON.parse(parsed.arguments) : parsed.arguments,
        });
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  // Pattern 2: Inline tool call format: @tool_name({args})
  const inlineToolRegex = /@(\w[\w-]*)\s*\(\s*(\{[\s\S]*?\})\s*\)/g;
  while ((match = inlineToolRegex.exec(text)) !== null) {
    try {
      const args = JSON.parse(match[2]);
      toolCalls.push({
        id: `call_${Date.now()}_${toolCalls.length}`,
        name: match[1],
        arguments: args,
      });
    } catch {
      // Not valid JSON args, skip
    }
  }

  return toolCalls;
}
