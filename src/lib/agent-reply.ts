/**
 * Agent Reply Logic
 * Gets agent's provider, builds messages, calls LLM, saves response
 */

import { db } from '@/lib/db';
import { chatCompletion, type ChatMessage, type LLMProviderConfig } from './llm-provider';

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
 * Generate an agent reply to a user message
 */
export async function generateAgentReply(params: AgentReplyParams): Promise<AgentReplyResult> {
  const { agentId, conversationId, userMessage, userId } = params;

  try {
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
      return { success: false, content: '', error: 'Agent not found' };
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

    // 5. Call the LLM
    const result = await chatCompletion(providerConfig, messages, model, {
      temperature: agent.temperature ?? 0.7,
      maxTokens: agent.maxTokens ?? 2048,
    });

    // 6. Save the agent's reply as a message
    await db.message.create({
      data: {
        conversationId,
        content: result.content,
        type: 'text',
        senderId: userId, // Keep reference for relation
        senderType: 'agent',
        senderName: agent.name,
        metadata: JSON.stringify({
          agentId: agent.id,
          model: result.model,
          usage: result.usage,
        }),
      },
    });

    // 7. Update agent status
    await db.agent.update({
      where: { id: agentId },
      data: { status: 'online' },
    });

    return { success: true, content: result.content };
  } catch (error) {
    // Update agent status to error
    await db.agent.update({
      where: { id: agentId },
      data: { status: 'error' },
    }).catch(() => {});

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, content: '', error: errorMessage };
  }
}
