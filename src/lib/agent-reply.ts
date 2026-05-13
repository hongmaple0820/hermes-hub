/**
 * Agent Reply Logic
 * Gets agent's provider, builds messages, calls LLM, saves response
 * Supports both synchronous and streaming (SSE) modes
 */

import { db } from '@/lib/db';
import { chatCompletion, chatCompletionStream, type ChatMessage, type LLMProviderConfig } from './llm-provider';

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

  // 4. Determine the LLM provider config
  let providerConfig: LLMProviderConfig;
  let model: string | undefined;

  if (agent.provider) {
    providerConfig = {
      provider: agent.provider.provider,
      apiKey: agent.provider.apiKey ?? undefined,
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

  return { agent, messages, providerConfig, model };
}

/**
 * Generate an agent reply to a user message (synchronous)
 */
export async function generateAgentReply(params: AgentReplyParams): Promise<AgentReplyResult> {
  try {
    const { agent, messages, providerConfig, model } = await prepareAgentContext(params);
    const { agentId, conversationId } = params;

    // Call the LLM
    const result = await chatCompletion(providerConfig, messages, model, {
      temperature: agent.temperature ?? 0.7,
      maxTokens: agent.maxTokens ?? 2048,
    });

    // Save the agent's reply as a message
    await db.message.create({
      data: {
        conversationId,
        content: result.content,
        type: 'text',
        senderId: null,
        senderType: 'agent',
        senderName: agent.name,
        metadata: JSON.stringify({
          agentId: agent.id,
          model: result.model,
          usage: result.usage,
        }),
      },
    });

    // Update agent status
    await db.agent.update({
      where: { id: agentId },
      data: { status: 'online' },
    });

    return { success: true, content: result.content };
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
 */
export async function* streamAgentReply(params: AgentReplyParams): AsyncGenerator<string> {
  const { agentId, conversationId } = params;
  let fullContent = '';
  let returnedModel = '';

  try {
    const { agent, messages, providerConfig, model } = await prepareAgentContext(params);

    // Stream the LLM response
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
        }),
      },
    });

    // Update agent status
    await db.agent.update({
      where: { id: agentId },
      data: { status: 'online' },
    });

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
