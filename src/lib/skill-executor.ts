/**
 * Skill Executor - Executes skills during agent chat interactions.
 *
 * Supports three execution modes:
 * - builtin: Execute built-in handler directly (placeholder for actual implementation)
 * - webhook: Send message to the skill's callback URL and collect the result
 * - function: Call the handlerUrl as a function endpoint
 *
 * Also provides buildToolDefinitions() to generate OpenAI function/tool definitions
 * from installed skills, allowing the LLM to "call" skills as tools during chat.
 */

import { db } from '@/lib/db';
import { sendCallback } from '@/lib/skill-protocol';

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

// ==================== Built-in Skill Handlers ====================

/**
 * Registry of built-in skill handlers.
 * In a production system, these would be actual implementations.
 * For now, they return descriptive responses indicating the skill was invoked.
 */
const BUILTIN_HANDLERS: Record<string, (params: Record<string, unknown>) => BuiltinHandlerResult> = {
  'web-search': (params) => ({
    content: `Web search executed for: "${params.query}"${params.maxResults ? ` (max ${params.maxResults} results)` : ''}. Results would be returned here in production.`,
    data: { query: params.query, results: [] },
  }),
  'weather-query': (params) => ({
    content: `Weather query for: "${params.location}"${params.unit ? ` in ${params.unit}` : ''}. Weather data would be returned here in production.`,
    data: { location: params.location, temperature: null, conditions: null },
  }),
  'code-execution': (params) => ({
    content: `Code execution requested in ${params.language}: ${typeof params.code === 'string' && (params.code as string).length > 50 ? (params.code as string).substring(0, 50) + '...' : params.code}. Execution output would be returned here in production.`,
    data: { language: params.language, output: null, exitCode: null },
  }),
  'image-generation': (params) => ({
    content: `Image generation requested with prompt: "${params.prompt}"${params.size ? ` at ${params.size}` : ''}. Image URL would be returned here in production.`,
    data: { prompt: params.prompt, imageUrl: null },
  }),
  'document-processing': (params) => ({
    content: `Document processing action: ${params.action}${params.fileUrl ? ` on ${params.fileUrl}` : ''}. Document result would be returned here in production.`,
    data: { action: params.action, fileUrl: params.fileUrl, result: null },
  }),
  'translation': (params) => ({
    content: `Translation from ${params.sourceLang || 'auto'} to ${params.targetLang}: "${typeof params.text === 'string' && (params.text as string).length > 50 ? (params.text as string).substring(0, 50) + '...' : params.text}". Translation would be returned here in production.`,
    data: { sourceLang: params.sourceLang, targetLang: params.targetLang, translatedText: null },
  }),
  'reminder': (params) => ({
    content: `Reminder set: "${params.message}" at ${params.time}${params.repeat ? ` (repeat: ${params.repeat})` : ''}.`,
    data: { message: params.message, time: params.time, repeat: params.repeat },
  }),
  'http-request': (params) => ({
    content: `HTTP ${params.method} request to: ${params.url}. Response would be returned here in production.`,
    data: { method: params.method, url: params.url, status: null, body: null },
  }),
  'data-analysis': (params) => ({
    content: `Data analysis (${params.analysis}) requested${params.visualize ? ' with visualization' : ''}. Analysis results would be returned here in production.`,
    data: { analysis: params.analysis, visualize: params.visualize, results: null },
  }),
  'email-sender': (params) => ({
    content: `Email sent to: ${params.to} with subject: "${params.subject}".`,
    data: { to: params.to, subject: params.subject, sent: true },
  }),
  'text-to-speech': (params) => ({
    content: `Text-to-speech conversion requested${params.voice ? ` with voice: ${params.voice}` : ''}. Audio URL would be returned here in production.`,
    data: { text: params.text, voice: params.voice, audioUrl: null },
  }),
  'database-query': (params) => ({
    content: `Database query executed: "${typeof params.query === 'string' && (params.query as string).length > 80 ? (params.query as string).substring(0, 80) + '...' : params.query}". Query results would be returned here in production.`,
    data: { query: params.query, database: params.database, rows: null },
  }),
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
          event: 'skill.invoke',
          timestamp: new Date().toISOString(),
          data: {
            skillName,
            params,
            context,
          },
        }
      );

      if (!webhookResult.success) {
        throw new Error(webhookResult.error || `Webhook call to ${callbackUrl} failed`);
      }

      return {
        type: 'webhook',
        skillName,
        status: webhookResult.status,
        params,
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
          event: 'skill.invoke',
          timestamp: new Date().toISOString(),
          data: {
            skillName,
            params,
            context,
          },
        }
      );

      if (!functionResult.success) {
        throw new Error(functionResult.error || `Function call to ${callbackUrl} failed`);
      }

      return {
        type: 'function',
        skillName,
        status: functionResult.status,
        params,
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
