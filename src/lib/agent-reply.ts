/**
 * Agent Reply Logic
 * Gets agent's provider, builds messages, calls LLM, saves response
 * Supports both synchronous and streaming (SSE) modes
 *
 * Enhanced with:
 * - Agent Memory: Automatically injects memory context into system prompts
 * - Tool Chain Execution: For builtin agents with skills, uses agentic tool chain loop
 */

import { db } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { chatCompletion, chatCompletionStream, type ChatMessage, type LLMProviderConfig } from './llm-provider';
import { buildToolDefinitions, executeToolChain, createLLMCaller, type SkillExecutionResult } from './skill-executor';
import { getMemoryManager, type MemoryContext } from './agent-memory';

interface AgentReplyParams {
  agentId: string;
  conversationId: string;
  userMessage: string;
  userId: string;
}

interface AgentReplyResult {
  success: boolean;
  content: string;
  error?: string;
  toolResults?: SkillExecutionResult[];
}

/**
 * Shared helper: build messages and provider config for an agent reply
 */
async function prepareAgentContext(params: AgentReplyParams) {
  const { agentId, conversationId, userMessage, userId } = params;

  // 1. Get the agent with its provider
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    include: {
      provider: true,
      skills: {
        where: { isEnabled: true },
        include: { skill: true },
        orderBy: { priority: 'asc' },
      },
    },
  });

  if (!agent) {
    throw new Error('Agent not found');
  }

  // 2. Get conversation history
  const recentMessages = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Reverse to chronological order
  const history = recentMessages.reverse();

  // 3. Build the messages array
  const messages: ChatMessage[] = [];

  // System prompt
  let systemPrompt = agent.systemPrompt || `You are ${agent.name}, a helpful AI assistant.`;

  // Add skill descriptions to system prompt if available
  if (agent.skills.length > 0) {
    const skillDescriptions = agent.skills
      .map((as) => `- ${as.skill.displayName}: ${as.skill.description}`)
      .join('\n');
    systemPrompt += `\n\nYou have the following skills available:\n${skillDescriptions}`;
    systemPrompt += `\n\nWhen you need to use a skill, respond with a tool call. You can call multiple tools if needed. After receiving tool results, you can continue using tools or provide your final answer.`;
  }

  // 4. Inject agent memory into system prompt
  let memoryContext: MemoryContext | null = null;
  try {
    const memoryManager = getMemoryManager(agentId);
    memoryContext = await memoryManager.buildMemoryContext();

    if (memoryContext.hasMemory) {
      systemPrompt += memoryContext.fullContext;
    }
  } catch (error) {
    console.error('[AgentReply] Failed to load memory context:', error);
    // Continue without memory — don't block the agent reply
  }

  messages.push({ role: 'system', content: systemPrompt });

  // Add conversation history
  for (const msg of history) {
    if (msg.senderType === 'user' && msg.senderId === userId) {
      messages.push({ role: 'user', content: msg.content });
    } else if (msg.senderType === 'agent') {
      messages.push({ role: 'assistant', content: msg.content });
    }
  }

  // Add the current user message if not already in history
  const lastUserMessage = history.find(
    (m) => m.senderType === 'user' && m.senderId === userId
  );
  if (!lastUserMessage || lastUserMessage.content !== userMessage) {
    messages.push({ role: 'user', content: userMessage });
  }

  // 5. Determine the LLM provider config
  let providerConfig: LLMProviderConfig;
  let model: string | undefined;

  if (agent.provider) {
    // Decrypt API key — it's stored encrypted in the database
    let decryptedApiKey = agent.provider.apiKey ?? undefined;
    if (decryptedApiKey) {
      try {
        decryptedApiKey = decrypt(decryptedApiKey);
      } catch {
        // If decryption fails, the key might be plaintext (legacy) — use as-is
      }
    }

    providerConfig = {
      provider: agent.provider.provider,
      apiKey: decryptedApiKey,
      baseUrl: agent.provider.baseUrl ?? undefined,
      defaultModel: agent.provider.defaultModel ?? undefined,
      config: JSON.parse(agent.provider.config || '{}'),
    };
    model = agent.model || agent.provider.defaultModel || undefined;
  } else {
    // Default to z-ai if no provider configured
    providerConfig = {
      provider: 'z-ai',
    };
    model = agent.model || undefined;
  }

  return { agent, messages, providerConfig, model, memoryContext };
}

/**
 * Generate an agent reply to a user message (synchronous)
 *
 * For builtin agents with skills installed, uses the tool chain execution
 * which creates an agentic loop (plan → execute tools → iterate).
 * For agents without skills, uses the standard single LLM call.
 */
export async function generateAgentReply(params: AgentReplyParams): Promise<AgentReplyResult> {
  try {
    const { agent, messages, providerConfig, model } = await prepareAgentContext(params);
    const { agentId, conversationId } = params;

    let resultContent: string;
    let toolResults: SkillExecutionResult[] = [];
    let resultModel: string = model || 'unknown';
    let resultUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

    // Check if agent has skills — use tool chain for agentic behavior
    const hasSkills = agent.skills && agent.skills.length > 0;

    if (hasSkills) {
      // Use tool chain execution for agentic loop
      const llmCaller = createLLMCaller(providerConfig, model, {
        temperature: agent.temperature ?? 0.7,
        maxTokens: agent.maxTokens ?? 2048,
      });

      const chainResult = await executeToolChain(
        agentId,
        params.userMessage,
        conversationId,
        llmCaller,
        5 // max iterations
      );

      resultContent = chainResult.content;
      toolResults = chainResult.toolResults;
    } else {
      // Standard single LLM call (no skills)
      const result = await chatCompletion(providerConfig, messages, model, {
        temperature: agent.temperature ?? 0.7,
        maxTokens: agent.maxTokens ?? 2048,
      });

      resultContent = result.content;
      resultModel = result.model;
      resultUsage = result.usage;
    }

    // Save the agent's reply as a message
    await db.message.create({
      data: {
        conversationId,
        content: resultContent,
        type: 'text',
        senderId: null,
        senderType: 'agent',
        senderName: agent.name,
        metadata: JSON.stringify({
          agentId: agent.id,
          model: resultModel,
          usage: resultUsage,
          toolResults: toolResults.length > 0 ? toolResults.map(tr => ({
            skillName: tr.skillName,
            success: tr.success,
            executionTime: tr.executionTime,
          })) : undefined,
        }),
      },
    });

    // Track usage
    if (resultUsage) {
      await db.usageRecord.create({
        data: {
          userId: params.userId,
          agentId: params.agentId,
          conversationId: params.conversationId,
          model: resultModel,
          provider: agent.provider?.provider,
          inputTokens: resultUsage.promptTokens || 0,
          outputTokens: resultUsage.completionTokens || 0,
          estimatedCost: ((resultUsage.promptTokens || 0) * 0.00001 + (resultUsage.completionTokens || 0) * 0.00003),
        },
      }).catch(() => {});
    }

    // Update agent status
    await db.agent.update({
      where: { id: agentId },
      data: { status: 'online' },
    });

    // Learn from interaction (auto-update agent memory)
    try {
      const memoryManager = getMemoryManager(agentId);
      await memoryManager.learnFromInteraction(params.userMessage, resultContent);
    } catch (error) {
      console.error('[AgentReply] Failed to learn from interaction:', error);
      // Non-critical — don't fail the reply
    }

    return { success: true, content: resultContent, toolResults: toolResults.length > 0 ? toolResults : undefined };
  } catch (error) {
    // Update agent status to error
    await db.agent.update({
      where: { id: params.agentId },
      data: { status: 'error' },
    }).catch(() => {});

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, content: '', error: errorMessage };
  }
}

/**
 * Stream an agent reply using SSE
 * Yields SSE-formatted events as strings for direct writing to the response
 *
 * Note: Tool chain execution doesn't support streaming — if the agent has skills,
 * we execute the tool chain synchronously and then stream the final result.
 * For agents without skills, we stream normally.
 */
export async function* streamAgentReply(params: AgentReplyParams): AsyncGenerator<string> {
  const { agentId, conversationId } = params;
  let fullContent = '';
  let returnedModel = '';
  let streamUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
  let toolResults: SkillExecutionResult[] = [];

  try {
    const { agent, messages, providerConfig, model } = await prepareAgentContext(params);

    // Check if agent has skills — use tool chain (non-streaming)
    const hasSkills = agent.skills && agent.skills.length > 0;

    if (hasSkills) {
      // Tool chain execution is synchronous — execute and then yield the result
      const llmCaller = createLLMCaller(providerConfig, model, {
        temperature: agent.temperature ?? 0.7,
        maxTokens: agent.maxTokens ?? 2048,
      });

      const chainResult = await executeToolChain(
        agentId,
        params.userMessage,
        conversationId,
        llmCaller,
        5
      );

      fullContent = chainResult.content;
      toolResults = chainResult.toolResults;

      // Yield the full content as a single chunk
      yield `data: ${JSON.stringify({ type: 'chunk', content: fullContent })}\n\n`;
      yield `data: ${JSON.stringify({ type: 'done' })}\n\n`;
    } else {
      // Standard streaming LLM call (no skills)
      const stream = chatCompletionStream(providerConfig, messages, model, {
        temperature: agent.temperature ?? 0.7,
        maxTokens: agent.maxTokens ?? 2048,
      });

      for await (const event of stream) {
        if (event.type === 'chunk' && event.content) {
          fullContent += event.content;
          yield `data: ${JSON.stringify({ type: 'chunk', content: event.content })}\n\n`;
        } else if (event.type === 'done') {
          if (event.model) returnedModel = event.model;
          if (event.content) fullContent = event.content;
          if (event.usage) streamUsage = event.usage;
        }
      }
    }

    // Save the complete agent reply as a message
    const savedMessage = await db.message.create({
      data: {
        conversationId,
        content: fullContent,
        type: 'text',
        senderId: null,
        senderType: 'agent',
        senderName: agent.name,
        metadata: JSON.stringify({
          agentId: agent.id,
          model: returnedModel,
          toolResults: toolResults.length > 0 ? toolResults.map(tr => ({
            skillName: tr.skillName,
            success: tr.success,
            executionTime: tr.executionTime,
          })) : undefined,
        }),
      },
    });

    // Track usage
    if (streamUsage) {
      await db.usageRecord.create({
        data: {
          userId: params.userId,
          agentId: params.agentId,
          conversationId: params.conversationId,
          model: returnedModel,
          provider: agent.provider?.provider,
          inputTokens: streamUsage.promptTokens || 0,
          outputTokens: streamUsage.completionTokens || 0,
          estimatedCost: ((streamUsage.promptTokens || 0) * 0.00001 + (streamUsage.completionTokens || 0) * 0.00003),
        },
      }).catch(() => {});
    }

    // Update agent status
    await db.agent.update({
      where: { id: agentId },
      data: { status: 'online' },
    });

    // Learn from interaction
    try {
      const memoryManager = getMemoryManager(agentId);
      await memoryManager.learnFromInteraction(params.userMessage, fullContent);
    } catch (error) {
      console.error('[AgentReply] Failed to learn from interaction:', error);
    }

    // Emit done event with the saved message ID
    yield `data: ${JSON.stringify({ type: 'done', messageId: savedMessage.id })}\n\n`;
  } catch (error) {
    // Update agent status to error
    await db.agent.update({
      where: { id: agentId },
      data: { status: 'error' },
    }).catch(() => {});

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    yield `data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`;
  }
}
