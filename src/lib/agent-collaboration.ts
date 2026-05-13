/**
 * Agent Collaboration Protocol for Hermes Hub
 *
 * Enables inter-agent collaboration with six patterns:
 * 1. Delegation  — Agent A delegates a sub-task to Agent B, gets result back
 * 2. Handoff     — Agent A transfers the conversation to Agent B (context handoff)
 * 3. Broadcast   — Agent A sends a message to multiple agents simultaneously
 * 4. Pipeline    — Agent A output → Agent B input → Agent C input (sequential)
 * 5. Round Robin — Multiple agents take turns responding in a chat room
 * 6. Consensus   — Multiple agents vote/evaluate and aggregate results
 *
 * Integrates with:
 * - generateAgentReply from @/lib/agent-reply for agent responses
 * - Prisma Conversation/Message models for persistence
 * - Notification system for collaboration events
 */

import { db } from '@/lib/db';
import { generateAgentReply } from '@/lib/agent-reply';
import { chatCompletion, type LLMProviderConfig } from '@/lib/llm-provider';

// ==================== Types ====================

export type CollaborationType =
  | 'delegation'
  | 'handoff'
  | 'broadcast'
  | 'pipeline'
  | 'round-robin'
  | 'consensus';

export type AggregateStrategy = 'best' | 'merge' | 'vote' | 'first-success';
export type VotingStrategy = 'majority' | 'unanimous' | 'weighted';

export interface CollaborationRequest {
  type: CollaborationType;
  fromAgentId: string;
  toAgentIds: string[];
  task: string;
  context?: Record<string, unknown>;
  options?: CollaborationOptions;
}

export interface CollaborationOptions {
  timeout?: number;           // Per-agent timeout in ms (default: 30000)
  maxRetries?: number;        // Max retries per agent (default: 1)
  parallel?: boolean;         // Run agents in parallel vs sequential (default: true for broadcast)
  aggregateStrategy?: AggregateStrategy;
  // For consensus:
  votingStrategy?: VotingStrategy;
  // For pipeline:
  transformBetween?: TransformStep[];
  // For round-robin:
  rounds?: number;            // Number of rounds (default: 2)
  conversationId?: string;    // Existing conversation to use
}

export interface TransformStep {
  fromIndex: number;
  toIndex: number;
  transform: string; // Instruction for how to transform output between steps
}

export interface AgentResult {
  agentId: string;
  agentName: string;
  content: string;
  success: boolean;
  error?: string;
  duration: number;
  tokenUsage?: { input: number; output: number };
}

export interface CollaborationResult {
  type: CollaborationType;
  success: boolean;
  results: AgentResult[];
  aggregatedResult?: string;
  duration: number;
  errors: string[];
}

// Internal tracking for collaboration history
interface CollaborationRecord {
  id: string;
  type: CollaborationType;
  fromAgentId: string;
  toAgentIds: string[];
  task: string;
  result: CollaborationResult;
  createdAt: Date;
}

// In-memory store for recent collaboration results (for GET history)
const collaborationHistory: Map<string, CollaborationRecord[]> = new Map();

const MAX_HISTORY_PER_USER = 100;

// ==================== Utility Helpers ====================

/** Create a timeout-aware promise wrapper */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/** Store a collaboration record in history */
function storeHistory(agentId: string, record: CollaborationRecord): void {
  const existing = collaborationHistory.get(agentId) || [];
  existing.unshift(record);
  if (existing.length > MAX_HISTORY_PER_USER) {
    existing.length = MAX_HISTORY_PER_USER;
  }
  collaborationHistory.set(agentId, existing);
}

/** Push notification for collaboration events */
async function pushCollaborationNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
    // Try to push via Socket.IO for real-time delivery
    await fetch('http://localhost:3003/internal/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        notification: { type, title, message, metadata, timestamp: new Date().toISOString() },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Silently fail — notifications are non-critical
  }
}

/** Validate that agents exist and belong to the user */
async function validateAgents(
  agentIds: string[],
  userId: string
): Promise<Map<string, { id: string; name: string; userId: string }>> {
  const agents = await db.agent.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, name: true, userId: true },
  });

  const agentMap = new Map<string, { id: string; name: string; userId: string }>();
  for (const agent of agents) {
    agentMap.set(agent.id, agent);
  }

  // Check all agents exist and user has access
  for (const id of agentIds) {
    const agent = agentMap.get(id);
    if (!agent) {
      throw new Error(`Agent not found: ${id}`);
    }
    if (agent.userId !== userId) {
      throw new Error(`Access denied for agent: ${id}`);
    }
  }

  return agentMap;
}

/** Get userId from an agent */
async function getAgentOwner(agentId: string): Promise<string> {
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    select: { userId: true },
  });
  if (!agent) throw new Error(`Agent not found: ${agentId}`);
  return agent.userId;
}

// ==================== Core Collaboration Functions ====================

/**
 * 1. DELEGATION
 * Agent A delegates a sub-task to Agent B, gets the result back.
 * Creates a temporary conversation with the target agent, sends the task,
 * and returns the response.
 */
export async function delegateToAgent(
  fromAgentId: string,
  toAgentId: string,
  task: string,
  context?: Record<string, unknown>,
  options?: CollaborationOptions
): Promise<CollaborationResult> {
  const startTime = Date.now();
  const timeout = options?.timeout ?? 30000;
  const errors: string[] = [];

  try {
    const userId = await getAgentOwner(fromAgentId);
    await validateAgents([fromAgentId, toAgentId], userId);

    // Get agent names for the result
    const agents = await db.agent.findMany({
      where: { id: { in: [fromAgentId, toAgentId] } },
      select: { id: true, name: true },
    });
    const agentNameMap = new Map(agents.map((a) => [a.id, a.name]));

    // Create a temporary conversation with the target agent
    const conversation = await db.conversation.create({
      data: {
        type: 'private',
        name: `[Delegation] ${agentNameMap.get(fromAgentId) || fromAgentId} → ${agentNameMap.get(toAgentId) || toAgentId}`,
        agentId: toAgentId,
        participants: {
          create: { userId },
        },
      },
    });

    // Build the task message with delegation context
    const contextStr = context
      ? `\n\nAdditional context: ${JSON.stringify(context, null, 2)}`
      : '';
    const delegationMessage = `[Delegation from ${agentNameMap.get(fromAgentId) || 'Agent'}]\n\n${task}${contextStr}`;

    // Save the delegation message
    await db.message.create({
      data: {
        conversationId: conversation.id,
        content: delegationMessage,
        type: 'text',
        senderType: 'system',
        senderName: agentNameMap.get(fromAgentId) || 'Delegating Agent',
        metadata: JSON.stringify({
          collaborationType: 'delegation',
          fromAgentId,
          toAgentId,
        }),
      },
    });

    // Generate the agent reply
    let agentResult: AgentResult;
    try {
      const reply = await withTimeout(
        generateAgentReply({
          agentId: toAgentId,
          conversationId: conversation.id,
          userMessage: delegationMessage,
          userId,
        }),
        timeout,
        `Delegation to agent ${toAgentId}`
      );

      agentResult = {
        agentId: toAgentId,
        agentName: agentNameMap.get(toAgentId) || toAgentId,
        content: reply.content,
        success: reply.success,
        error: reply.error,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      agentResult = {
        agentId: toAgentId,
        agentName: agentNameMap.get(toAgentId) || toAgentId,
        content: '',
        success: false,
        error: errorMsg,
        duration: Date.now() - startTime,
      };
      errors.push(`Agent ${toAgentId}: ${errorMsg}`);
    }

    // Store the delegation result as a system message in the original conversation (if any)
    const resultMessage = agentResult.success
      ? `Delegation result: ${agentResult.content}`
      : `Delegation failed: ${agentResult.error}`;

    await db.message.create({
      data: {
        conversationId: conversation.id,
        content: resultMessage,
        type: 'system',
        senderType: 'system',
        senderName: 'Collaboration Protocol',
        metadata: JSON.stringify({
          collaborationType: 'delegation-result',
          fromAgentId,
          toAgentId,
          success: agentResult.success,
        }),
      },
    });

    const result: CollaborationResult = {
      type: 'delegation',
      success: agentResult.success,
      results: [agentResult],
      aggregatedResult: agentResult.success ? agentResult.content : undefined,
      duration: Date.now() - startTime,
      errors,
    };

    // Store in history
    storeHistory(fromAgentId, {
      id: conversation.id,
      type: 'delegation',
      fromAgentId,
      toAgentIds: [toAgentId],
      task,
      result,
      createdAt: new Date(),
    });

    // Push notification
    await pushCollaborationNotification(userId, 'info', 'Delegation Complete', resultMessage, {
      collaborationType: 'delegation',
      fromAgentId,
      toAgentId,
    });

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return {
      type: 'delegation',
      success: false,
      results: [],
      duration: Date.now() - startTime,
      errors: [errorMsg],
    };
  }
}

/**
 * 2. HANDOFF
 * Agent A transfers the conversation to Agent B with context summary.
 * The conversation's agentId is updated to the new agent, and a system
 * message is posted about the handoff.
 */
export async function handoffConversation(
  conversationId: string,
  fromAgentId: string,
  toAgentId: string,
  summary?: string,
  options?: CollaborationOptions
): Promise<CollaborationResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    const userId = await getAgentOwner(fromAgentId);
    await validateAgents([fromAgentId, toAgentId], userId);

    // Verify the conversation exists and is currently with the fromAgent
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    if (conversation.agentId !== fromAgentId) {
      throw new Error(`Conversation is not currently handled by agent ${fromAgentId}`);
    }

    // Get agent names
    const agents = await db.agent.findMany({
      where: { id: { in: [fromAgentId, toAgentId] } },
      select: { id: true, name: true },
    });
    const agentNameMap = new Map(agents.map((a) => [a.id, a.name]));

    const fromName = agentNameMap.get(fromAgentId) || fromAgentId;
    const toName = agentNameMap.get(toAgentId) || toAgentId;

    // Generate a summary if not provided
    let handoffSummary = summary || '';
    if (!handoffSummary) {
      try {
        const recentMessages = conversation.messages
          .reverse()
          .map((m) => `${m.senderType}(${m.senderName || 'unknown'}): ${m.content}`)
          .join('\n');

        handoffSummary = await generateHandoffSummary(recentMessages, fromName, toName);
      } catch {
        handoffSummary = `Conversation was handed off from ${fromName} to ${toName}.`;
      }
    }

    // Update the conversation to use the new agent
    await db.conversation.update({
      where: { id: conversationId },
      data: { agentId: toAgentId },
    });

    // Post a system message about the handoff
    await db.message.create({
      data: {
        conversationId,
        content: `[Handoff] ${fromName} has handed off this conversation to ${toName}.\n\nContext Summary:\n${handoffSummary}`,
        type: 'system',
        senderType: 'system',
        senderName: 'Collaboration Protocol',
        metadata: JSON.stringify({
          collaborationType: 'handoff',
          fromAgentId,
          toAgentId,
          summary: handoffSummary,
        }),
      },
    });

    const agentResult: AgentResult = {
      agentId: toAgentId,
      agentName: toName,
      content: `Handoff from ${fromName} to ${toName} completed.`,
      success: true,
      duration: Date.now() - startTime,
    };

    const result: CollaborationResult = {
      type: 'handoff',
      success: true,
      results: [agentResult],
      aggregatedResult: handoffSummary,
      duration: Date.now() - startTime,
      errors,
    };

    // Store in history
    storeHistory(fromAgentId, {
      id: conversationId,
      type: 'handoff',
      fromAgentId,
      toAgentIds: [toAgentId],
      task: 'Conversation handoff',
      result,
      createdAt: new Date(),
    });

    // Push notification
    await pushCollaborationNotification(userId, 'info', 'Conversation Handed Off', `Conversation handed off from ${fromName} to ${toName}`, {
      collaborationType: 'handoff',
      conversationId,
      fromAgentId,
      toAgentId,
    });

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return {
      type: 'handoff',
      success: false,
      results: [],
      duration: Date.now() - startTime,
      errors: [errorMsg],
    };
  }
}

/**
 * 3. BROADCAST
 * Sends the same task to multiple agents (parallel or sequential),
 * collects all responses, and aggregates using the specified strategy.
 */
export async function broadcastToAgents(
  fromAgentId: string,
  toAgentIds: string[],
  task: string,
  context?: Record<string, unknown>,
  options?: CollaborationOptions
): Promise<CollaborationResult> {
  const startTime = Date.now();
  const timeout = options?.timeout ?? 30000;
  const parallel = options?.parallel ?? true;
  const aggregateStrategy = options?.aggregateStrategy ?? 'merge';
  const errors: string[] = [];

  try {
    const userId = await getAgentOwner(fromAgentId);
    await validateAgents([fromAgentId, ...toAgentIds], userId);

    // Get agent names
    const allAgentIds = [fromAgentId, ...toAgentIds];
    const agents = await db.agent.findMany({
      where: { id: { in: allAgentIds } },
      select: { id: true, name: true },
    });
    const agentNameMap = new Map(agents.map((a) => [a.id, a.name]));

    const contextStr = context
      ? `\n\nAdditional context: ${JSON.stringify(context, null, 2)}`
      : '';
    const broadcastMessage = `[Broadcast from ${agentNameMap.get(fromAgentId) || 'Agent'}]\n\n${task}${contextStr}`;

    // Execute agents
    const executeAgent = async (agentId: string): Promise<AgentResult> => {
      const agentStart = Date.now();
      try {
        // Create a conversation for this broadcast
        const conversation = await db.conversation.create({
          data: {
            type: 'private',
            name: `[Broadcast] ${agentNameMap.get(fromAgentId) || fromAgentId} → ${agentNameMap.get(agentId) || agentId}`,
            agentId,
            participants: { create: { userId } },
          },
        });

        // Save the broadcast message
        await db.message.create({
          data: {
            conversationId: conversation.id,
            content: broadcastMessage,
            type: 'text',
            senderType: 'system',
            senderName: agentNameMap.get(fromAgentId) || 'Broadcasting Agent',
            metadata: JSON.stringify({
              collaborationType: 'broadcast',
              fromAgentId,
            }),
          },
        });

        const reply = await withTimeout(
          generateAgentReply({
            agentId,
            conversationId: conversation.id,
            userMessage: broadcastMessage,
            userId,
          }),
          timeout,
          `Broadcast to agent ${agentId}`
        );

        return {
          agentId,
          agentName: agentNameMap.get(agentId) || agentId,
          content: reply.content,
          success: reply.success,
          error: reply.error,
          duration: Date.now() - agentStart,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        return {
          agentId,
          agentName: agentNameMap.get(agentId) || agentId,
          content: '',
          success: false,
          error: errorMsg,
          duration: Date.now() - agentStart,
        };
      }
    };

    let results: AgentResult[];
    if (parallel) {
      results = await Promise.all(toAgentIds.map(executeAgent));
    } else {
      results = [];
      for (const agentId of toAgentIds) {
        results.push(await executeAgent(agentId));
      }
    }

    // Collect errors
    for (const r of results) {
      if (!r.success && r.error) {
        errors.push(`Agent ${r.agentName}: ${r.error}`);
      }
    }

    // Aggregate results
    const aggregatedResult = aggregateResults(results, aggregateStrategy);

    const result: CollaborationResult = {
      type: 'broadcast',
      success: results.some((r) => r.success),
      results,
      aggregatedResult,
      duration: Date.now() - startTime,
      errors,
    };

    // Store in history
    storeHistory(fromAgentId, {
      id: `broadcast-${Date.now()}`,
      type: 'broadcast',
      fromAgentId,
      toAgentIds,
      task,
      result,
      createdAt: new Date(),
    });

    // Push notification
    const successCount = results.filter((r) => r.success).length;
    await pushCollaborationNotification(
      userId,
      'info',
      'Broadcast Complete',
      `Broadcast to ${toAgentIds.length} agents: ${successCount} succeeded, ${results.length - successCount} failed`,
      { collaborationType: 'broadcast', fromAgentId, successCount, totalAgents: toAgentIds.length }
    );

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return {
      type: 'broadcast',
      success: false,
      results: [],
      duration: Date.now() - startTime,
      errors: [errorMsg],
    };
  }
}

/**
 * 4. PIPELINE
 * Executes agents sequentially, passing each output as input to the next.
 * Optionally transforms between steps.
 */
export async function pipelineExecution(
  agentIds: string[],
  initialTask: string,
  transformBetween?: TransformStep[],
  context?: Record<string, unknown>,
  options?: CollaborationOptions
): Promise<CollaborationResult> {
  const startTime = Date.now();
  const timeout = options?.timeout ?? 60000; // Longer timeout for pipeline
  const errors: string[] = [];

  if (agentIds.length < 2) {
    return {
      type: 'pipeline',
      success: false,
      results: [],
      duration: 0,
      errors: ['Pipeline requires at least 2 agents'],
    };
  }

  try {
    const firstAgent = await db.agent.findUnique({
      where: { id: agentIds[0] },
      select: { userId: true },
    });
    if (!firstAgent) throw new Error(`Agent not found: ${agentIds[0]}`);

    const userId = firstAgent.userId;
    await validateAgents(agentIds, userId);

    // Get agent names
    const agents = await db.agent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    });
    const agentNameMap = new Map(agents.map((a) => [a.id, a.name]));

    const results: AgentResult[] = [];
    let currentInput = initialTask;
    const contextStr = context
      ? `\n\nPipeline context: ${JSON.stringify(context, null, 2)}`
      : '';

    for (let i = 0; i < agentIds.length; i++) {
      const agentId = agentIds[i];
      const agentStart = Date.now();
      const isLast = i === agentIds.length - 1;

      try {
        // Build the input message for this step
        let stepMessage: string;
        if (i === 0) {
          stepMessage = `[Pipeline Step 1/${agentIds.length}]\n\n${initialTask}${contextStr}`;
        } else {
          // Check for transform between steps
          const transform = transformBetween?.find(
            (t) => t.fromIndex === i - 1 && t.toIndex === i
          );

          if (transform) {
            stepMessage = `[Pipeline Step ${i + 1}/${agentIds.length} — Transformed Input]\n\nTransform instruction: ${transform.transform}\n\nPrevious output:\n${currentInput}`;
          } else {
            stepMessage = `[Pipeline Step ${i + 1}/${agentIds.length}]\n\nBased on the previous agent's output, continue the pipeline:\n\n${currentInput}`;
          }
        }

        // Create a conversation for this pipeline step
        const conversation = await db.conversation.create({
          data: {
            type: 'private',
            name: `[Pipeline Step ${i + 1}] ${agentNameMap.get(agentId) || agentId}`,
            agentId,
            participants: { create: { userId } },
          },
        });

        // Save the step message
        await db.message.create({
          data: {
            conversationId: conversation.id,
            content: stepMessage,
            type: 'text',
            senderType: 'system',
            senderName: `Pipeline (Step ${i + 1})`,
            metadata: JSON.stringify({
              collaborationType: 'pipeline',
              stepIndex: i,
              totalSteps: agentIds.length,
            }),
          },
        });

        const reply = await withTimeout(
          generateAgentReply({
            agentId,
            conversationId: conversation.id,
            userMessage: stepMessage,
            userId,
          }),
          timeout,
          `Pipeline step ${i + 1} (agent ${agentId})`
        );

        const agentResult: AgentResult = {
          agentId,
          agentName: agentNameMap.get(agentId) || agentId,
          content: reply.content,
          success: reply.success,
          error: reply.error,
          duration: Date.now() - agentStart,
        };

        results.push(agentResult);

        if (!reply.success) {
          errors.push(`Pipeline step ${i + 1} (agent ${agentNameMap.get(agentId) || agentId}): ${reply.error || 'Failed'}`);
          // Pipeline stops on failure unless it's the last step
          if (!isLast) {
            break;
          }
        }

        // Pass output to next step
        currentInput = reply.content;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        results.push({
          agentId,
          agentName: agentNameMap.get(agentId) || agentId,
          content: '',
          success: false,
          error: errorMsg,
          duration: Date.now() - agentStart,
        });
        errors.push(`Pipeline step ${i + 1} (agent ${agentNameMap.get(agentId) || agentId}): ${errorMsg}`);
        break; // Stop pipeline on error
      }
    }

    // The aggregated result is the output of the last successful step
    const lastSuccessful = [...results].reverse().find((r) => r.success);

    const result: CollaborationResult = {
      type: 'pipeline',
      success: results.every((r) => r.success),
      results,
      aggregatedResult: lastSuccessful?.content,
      duration: Date.now() - startTime,
      errors,
    };

    // Store in history
    storeHistory(agentIds[0], {
      id: `pipeline-${Date.now()}`,
      type: 'pipeline',
      fromAgentId: agentIds[0],
      toAgentIds: agentIds.slice(1),
      task: initialTask,
      result,
      createdAt: new Date(),
    });

    // Push notification
    const completedSteps = results.filter((r) => r.success).length;
    await pushCollaborationNotification(
      userId,
      results.every((r) => r.success) ? 'success' : 'warning',
      'Pipeline Execution Complete',
      `Pipeline: ${completedSteps}/${agentIds.length} steps completed`,
      { collaborationType: 'pipeline', completedSteps, totalSteps: agentIds.length }
    );

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return {
      type: 'pipeline',
      success: false,
      results: [],
      duration: Date.now() - startTime,
      errors: [errorMsg],
    };
  }
}

/**
 * 5. ROUND ROBIN
 * Multiple agents take turns responding to a topic and previous responses.
 * Runs for N rounds. Returns the full discussion thread.
 */
export async function roundRobinDiscussion(
  agentIds: string[],
  topic: string,
  rounds?: number,
  conversationId?: string,
  context?: Record<string, unknown>,
  options?: CollaborationOptions
): Promise<CollaborationResult> {
  const startTime = Date.now();
  const timeout = options?.timeout ?? 45000;
  const totalRounds = rounds ?? 2;
  const errors: string[] = [];

  if (agentIds.length < 2) {
    return {
      type: 'round-robin',
      success: false,
      results: [],
      duration: 0,
      errors: ['Round robin requires at least 2 agents'],
    };
  }

  try {
    const firstAgent = await db.agent.findUnique({
      where: { id: agentIds[0] },
      select: { userId: true },
    });
    if (!firstAgent) throw new Error(`Agent not found: ${agentIds[0]}`);

    const userId = firstAgent.userId;
    await validateAgents(agentIds, userId);

    // Get agent names
    const agents = await db.agent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    });
    const agentNameMap = new Map(agents.map((a) => [a.id, a.name]));

    // Use existing conversation or create a group conversation
    let convId = conversationId;
    if (!convId) {
      const conversation = await db.conversation.create({
        data: {
          type: 'group',
          name: `[Round Robin] ${topic.slice(0, 50)}`,
          participants: { create: { userId } },
        },
      });
      convId = conversation.id;
    }

    // Post the topic
    const contextStr = context
      ? `\n\nDiscussion context: ${JSON.stringify(context, null, 2)}`
      : '';
    await db.message.create({
      data: {
        conversationId: convId,
        content: `[Round Robin Discussion Topic]\n\n${topic}${contextStr}\n\nEach agent will respond in turn for ${totalRounds} round(s).`,
        type: 'system',
        senderType: 'system',
        senderName: 'Collaboration Protocol',
        metadata: JSON.stringify({
          collaborationType: 'round-robin',
          agentIds,
          rounds: totalRounds,
        }),
      },
    });

    const results: AgentResult[] = [];
    const discussionThread: string[] = [];

    for (let round = 0; round < totalRounds; round++) {
      for (let agentIdx = 0; agentIdx < agentIds.length; agentIdx++) {
        const agentId = agentIds[agentIdx];
        const agentName = agentNameMap.get(agentId) || agentId;
        const agentStart = Date.now();

        try {
          // Build the prompt including previous discussion
          let roundRobinPrompt: string;
          if (round === 0 && agentIdx === 0) {
            roundRobinPrompt = `[Round Robin Discussion — Round ${round + 1}]\n\nYou are participating in a round-robin discussion with ${agentIds.length} agents.\n\nTopic: ${topic}\n\nPlease share your perspective on this topic.`;
          } else {
            const threadSummary = discussionThread.join('\n\n');
            roundRobinPrompt = `[Round Robin Discussion — Round ${round + 1}]\n\nYou are ${agentName}, participating in a round-robin discussion.\n\nTopic: ${topic}\n\nPrevious discussion:\n${threadSummary}\n\nPlease add your perspective, building on what others have said.`;
          }

          // Update conversation agent for this turn
          await db.conversation.update({
            where: { id: convId },
            data: { agentId },
          });

          // Save the round-robin prompt
          await db.message.create({
            data: {
              conversationId: convId,
              content: roundRobinPrompt,
              type: 'text',
              senderType: 'system',
              senderName: `Round Robin (Round ${round + 1})`,
              metadata: JSON.stringify({
                collaborationType: 'round-robin',
                round: round + 1,
                agentId,
                agentIdx,
              }),
            },
          });

          const reply = await withTimeout(
            generateAgentReply({
              agentId,
              conversationId: convId,
              userMessage: roundRobinPrompt,
              userId,
            }),
            timeout,
            `Round robin — round ${round + 1}, agent ${agentName}`
          );

          const agentResult: AgentResult = {
            agentId,
            agentName,
            content: reply.content,
            success: reply.success,
            error: reply.error,
            duration: Date.now() - agentStart,
          };

          results.push(agentResult);

          if (reply.success) {
            discussionThread.push(`**${agentName}** (Round ${round + 1}): ${reply.content}`);
          } else {
            errors.push(`Round ${round + 1}, ${agentName}: ${reply.error || 'Failed'}`);
            discussionThread.push(`**${agentName}** (Round ${round + 1}): [Failed to respond]`);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          results.push({
            agentId,
            agentName,
            content: '',
            success: false,
            error: errorMsg,
            duration: Date.now() - agentStart,
          });
          errors.push(`Round ${round + 1}, ${agentName}: ${errorMsg}`);
          discussionThread.push(`**${agentName}** (Round ${round + 1}): [Error: ${errorMsg}]`);
        }
      }
    }

    // Build aggregated discussion transcript
    const aggregatedResult = discussionThread.join('\n\n---\n\n');

    const result: CollaborationResult = {
      type: 'round-robin',
      success: results.some((r) => r.success),
      results,
      aggregatedResult,
      duration: Date.now() - startTime,
      errors,
    };

    // Store in history
    storeHistory(agentIds[0], {
      id: convId,
      type: 'round-robin',
      fromAgentId: agentIds[0],
      toAgentIds: agentIds.slice(1),
      task: topic,
      result,
      createdAt: new Date(),
    });

    // Push notification
    await pushCollaborationNotification(
      userId,
      'info',
      'Round Robin Complete',
      `Round robin discussion completed: ${totalRounds} rounds with ${agentIds.length} agents`,
      { collaborationType: 'round-robin', rounds: totalRounds, agentCount: agentIds.length }
    );

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return {
      type: 'round-robin',
      success: false,
      results: [],
      duration: Date.now() - startTime,
      errors: [errorMsg],
    };
  }
}

/**
 * 6. CONSENSUS
 * Multiple agents evaluate a question independently, then votes/positions
 * are aggregated to reach a consensus.
 */
export async function consensusVote(
  agentIds: string[],
  question: string,
  context?: Record<string, unknown>,
  options?: CollaborationOptions
): Promise<CollaborationResult> {
  const startTime = Date.now();
  const timeout = options?.timeout ?? 30000;
  const votingStrategy = options?.votingStrategy ?? 'majority';
  const errors: string[] = [];

  if (agentIds.length < 2) {
    return {
      type: 'consensus',
      success: false,
      results: [],
      duration: 0,
      errors: ['Consensus requires at least 2 agents'],
    };
  }

  try {
    const firstAgent = await db.agent.findUnique({
      where: { id: agentIds[0] },
      select: { userId: true },
    });
    if (!firstAgent) throw new Error(`Agent not found: ${agentIds[0]}`);

    const userId = firstAgent.userId;
    await validateAgents(agentIds, userId);

    // Get agent names
    const agents = await db.agent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    });
    const agentNameMap = new Map(agents.map((a) => [a.id, a.name]));

    const contextStr = context
      ? `\n\nAdditional context: ${JSON.stringify(context, null, 2)}`
      : '';

    // Each agent evaluates independently
    const executeVote = async (agentId: string): Promise<AgentResult> => {
      const agentStart = Date.now();
      const agentName = agentNameMap.get(agentId) || agentId;

      try {
        const conversation = await db.conversation.create({
          data: {
            type: 'private',
            name: `[Consensus Vote] ${agentName}`,
            agentId,
            participants: { create: { userId } },
          },
        });

        const votePrompt = `[Consensus Vote Request]\n\nYou are participating in a consensus evaluation with ${agentIds.length} agents.\n\nQuestion: ${question}${contextStr}\n\nPlease provide your evaluation and clearly state your position (e.g., FOR/AGAINST, YES/NO, or a score from 1-10) along with your reasoning. End your response with a clear position statement in the format: POSITION: [your position]`;

        await db.message.create({
          data: {
            conversationId: conversation.id,
            content: votePrompt,
            type: 'text',
            senderType: 'system',
            senderName: 'Consensus Protocol',
            metadata: JSON.stringify({
              collaborationType: 'consensus',
              agentId,
            }),
          },
        });

        const reply = await withTimeout(
          generateAgentReply({
            agentId,
            conversationId: conversation.id,
            userMessage: votePrompt,
            userId,
          }),
          timeout,
          `Consensus vote from agent ${agentName}`
        );

        return {
          agentId,
          agentName,
          content: reply.content,
          success: reply.success,
          error: reply.error,
          duration: Date.now() - agentStart,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        return {
          agentId,
          agentName,
          content: '',
          success: false,
          error: errorMsg,
          duration: Date.now() - agentStart,
        };
      }
    };

    // Run all votes in parallel
    const results = await Promise.all(agentIds.map(executeVote));

    // Collect errors
    for (const r of results) {
      if (!r.success && r.error) {
        errors.push(`Agent ${r.agentName}: ${r.error}`);
      }
    }

    // Parse positions from agent responses
    const positions = parsePositions(results);

    // Determine consensus
    const aggregatedResult = determineConsensus(
      question,
      results,
      positions,
      votingStrategy
    );

    const result: CollaborationResult = {
      type: 'consensus',
      success: results.some((r) => r.success),
      results,
      aggregatedResult,
      duration: Date.now() - startTime,
      errors,
    };

    // Store in history
    storeHistory(agentIds[0], {
      id: `consensus-${Date.now()}`,
      type: 'consensus',
      fromAgentId: agentIds[0],
      toAgentIds: agentIds.slice(1),
      task: question,
      result,
      createdAt: new Date(),
    });

    // Push notification
    await pushCollaborationNotification(
      userId,
      'info',
      'Consensus Vote Complete',
      aggregatedResult?.slice(0, 200) || 'Consensus evaluation completed',
      { collaborationType: 'consensus', votingStrategy, agentCount: agentIds.length }
    );

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return {
      type: 'consensus',
      success: false,
      results: [],
      duration: Date.now() - startTime,
      errors: [errorMsg],
    };
  }
}

// ==================== Main Dispatcher ====================

/**
 * Execute a collaboration request by dispatching to the appropriate pattern.
 */
export async function executeCollaboration(
  request: CollaborationRequest
): Promise<CollaborationResult> {
  const { type, fromAgentId, toAgentIds, task, context, options } = request;

  switch (type) {
    case 'delegation': {
      if (toAgentIds.length !== 1) {
        return {
          type,
          success: false,
          results: [],
          duration: 0,
          errors: ['Delegation requires exactly one target agent'],
        };
      }
      return delegateToAgent(fromAgentId, toAgentIds[0], task, context, options);
    }

    case 'handoff': {
      if (toAgentIds.length !== 1) {
        return {
          type,
          success: false,
          results: [],
          duration: 0,
          errors: ['Handoff requires exactly one target agent and a conversationId'],
        };
      }
      const convId = options?.conversationId || context?.conversationId as string | undefined;
      if (!convId) {
        return {
          type,
          success: false,
          results: [],
          duration: 0,
          errors: ['Handoff requires a conversationId in options or context'],
        };
      }
      return handoffConversation(convId, fromAgentId, toAgentIds[0], context?.summary as string | undefined, options);
    }

    case 'broadcast': {
      return broadcastToAgents(fromAgentId, toAgentIds, task, context, options);
    }

    case 'pipeline': {
      return pipelineExecution(
        [fromAgentId, ...toAgentIds],
        task,
        options?.transformBetween,
        context,
        options
      );
    }

    case 'round-robin': {
      return roundRobinDiscussion(
        [fromAgentId, ...toAgentIds],
        task,
        options?.rounds,
        options?.conversationId,
        context,
        options
      );
    }

    case 'consensus': {
      return consensusVote(
        [fromAgentId, ...toAgentIds],
        task,
        context,
        options
      );
    }

    default:
      return {
        type: type as CollaborationType,
        success: false,
        results: [],
        duration: 0,
        errors: [`Unknown collaboration type: ${type}`],
      };
  }
}

/**
 * Get collaboration history for an agent.
 */
export function getCollaborationHistory(
  agentId: string,
  type?: CollaborationType,
  limit?: number
): CollaborationRecord[] {
  const records = collaborationHistory.get(agentId) || [];
  const filtered = type ? records.filter((r) => r.type === type) : records;
  return filtered.slice(0, limit ?? 50);
}

// ==================== Private Helpers ====================

/**
 * Generate a handoff summary using LLM or a simple fallback.
 */
async function generateHandoffSummary(
  recentMessages: string,
  fromAgentName: string,
  toAgentName: string
): Promise<string> {
  // Try to find an active LLM provider for the summary
  try {
    const provider = await db.lLMProvider.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (provider) {
      const config: LLMProviderConfig = {
        provider: provider.provider,
        apiKey: provider.apiKey ?? undefined,
        baseUrl: provider.baseUrl ?? undefined,
        defaultModel: provider.defaultModel ?? undefined,
      };

      const result = await chatCompletion(
        config,
        [
          {
            role: 'system',
            content: 'You are a conversation summarization assistant. Create a concise summary of the conversation that captures the key topics, decisions made, and any action items. This summary will be used to hand off the conversation to another agent.',
          },
          {
            role: 'user',
            content: `Summarize this conversation for a handoff from ${fromAgentName} to ${toAgentName}:\n\n${recentMessages.slice(0, 4000)}`,
          },
        ],
        undefined,
        { temperature: 0.3, maxTokens: 512 }
      );

      return result.content;
    }
  } catch {
    // Fall through to simple summary
  }

  // Simple fallback: just take the last few messages
  const lines = recentMessages.split('\n').slice(-5);
  return `Conversation handed off from ${fromAgentName} to ${toAgentName}.\n\nRecent context:\n${lines.join('\n')}`;
}

/**
 * Aggregate results from multiple agents using the specified strategy.
 */
function aggregateResults(
  results: AgentResult[],
  strategy: AggregateStrategy
): string {
  const successful = results.filter((r) => r.success);

  if (successful.length === 0) {
    return 'All agents failed to produce results.';
  }

  switch (strategy) {
    case 'first-success': {
      return successful[0].content;
    }

    case 'best': {
      // Select the longest response (simple heuristic for "best")
      const best = successful.reduce((prev, curr) =>
        curr.content.length > prev.content.length ? curr : prev
      );
      return best.content;
    }

    case 'merge': {
      // Merge all responses with attribution
      return successful
        .map((r) => `**${r.agentName}**: ${r.content}`)
        .join('\n\n---\n\n');
    }

    case 'vote': {
      // Count position mentions and return the majority position
      const positions = parsePositions(results);
      const positionCounts = new Map<string, number>();

      for (const pos of positions.values()) {
        const normalized = pos.toUpperCase().trim();
        positionCounts.set(normalized, (positionCounts.get(normalized) || 0) + 1);
      }

      let majorityPosition = '';
      let maxCount = 0;
      for (const [pos, count] of positionCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          majorityPosition = pos;
        }
      }

      const voteSummary = successful
        .map((r) => {
          const pos = positions.get(r.agentId) || 'Unknown';
          return `**${r.agentName}**: ${pos}\n${r.content.slice(0, 200)}...`;
        })
        .join('\n\n');

      return `**Majority Position: ${majorityPosition}** (${maxCount}/${successful.length} agents)\n\n${voteSummary}`;
    }

    default:
      return successful.map((r) => r.content).join('\n\n');
  }
}

/**
 * Parse positions from agent responses.
 * Looks for "POSITION: X" patterns in the content.
 */
function parsePositions(results: AgentResult[]): Map<string, string> {
  const positions = new Map<string, string>();

  for (const result of results) {
    if (!result.success || !result.content) continue;

    // Try to find a POSITION: statement
    const positionMatch = result.content.match(/POSITION:\s*(.+?)(?:\n|$)/i);
    if (positionMatch) {
      positions.set(result.agentId, positionMatch[1].trim());
      continue;
    }

    // Fallback: try to detect YES/NO/FOR/AGAINST
    const upper = result.content.toUpperCase();
    if (upper.includes('YES') || upper.includes('FOR') || upper.includes('AGREE') || upper.includes('SUPPORT')) {
      positions.set(result.agentId, 'YES');
    } else if (upper.includes('NO') || upper.includes('AGAINST') || upper.includes('DISAGREE') || upper.includes('OPPOSE')) {
      positions.set(result.agentId, 'NO');
    } else {
      positions.set(result.agentId, 'NEUTRAL');
    }
  }

  return positions;
}

/**
 * Determine consensus based on voting strategy.
 */
function determineConsensus(
  question: string,
  results: AgentResult[],
  positions: Map<string, string>,
  strategy: VotingStrategy
): string {
  const successful = results.filter((r) => r.success);

  if (successful.length === 0) {
    return 'No agents provided successful responses. Consensus could not be reached.';
  }

  const positionCounts = new Map<string, number>();
  for (const pos of positions.values()) {
    const normalized = pos.toUpperCase().trim();
    positionCounts.set(normalized, (positionCounts.get(normalized) || 0) + 1);
  }

  // Sort by count descending
  const sortedPositions = [...positionCounts.entries()].sort((a, b) => b[1] - a[1]);
  const totalVotes = successful.length;

  const individualResponses = successful
    .map((r) => {
      const pos = positions.get(r.agentId) || 'Unknown';
      return `**${r.agentName}** (${pos}): ${r.content.slice(0, 300)}...`;
    })
    .join('\n\n---\n\n');

  let consensusVerdict: string;

  switch (strategy) {
    case 'majority': {
      const majority = sortedPositions[0];
      if (majority && majority[1] > totalVotes / 2) {
        consensusVerdict = `MAJORITY CONSENSUS: ${majority[0]} (${majority[1]}/${totalVotes} agents)`;
      } else {
        consensusVerdict = `NO MAJORITY CONSENSUS (positions: ${sortedPositions.map(([p, c]) => `${p}(${c})`).join(', ')})`;
      }
      break;
    }

    case 'unanimous': {
      const isUnanimous = sortedPositions.length === 1 && sortedPositions[0][1] === totalVotes;
      if (isUnanimous) {
        consensusVerdict = `UNANIMOUS CONSENSUS: ${sortedPositions[0][0]} (${totalVotes}/${totalVotes} agents)`;
      } else {
        consensusVerdict = `NO UNANIMOUS CONSENSUS (positions: ${sortedPositions.map(([p, c]) => `${p}(${c})`).join(', ')})`;
      }
      break;
    }

    case 'weighted': {
      // Weight by response length (longer = more detailed reasoning = higher weight)
      const weightedScores = new Map<string, number>();
      for (const r of successful) {
        const pos = positions.get(r.agentId) || 'Unknown';
        const weight = Math.min(r.content.length / 100, 3); // Cap weight at 3
        weightedScores.set(pos, (weightedScores.get(pos) || 0) + weight);
      }

      const sortedWeighted = [...weightedScores.entries()].sort((a, b) => b[1] - a[1]);
      const topWeighted = sortedWeighted[0];
      const totalWeight = [...weightedScores.values()].reduce((a, b) => a + b, 0);
      const percentage = topWeighted ? Math.round((topWeighted[1] / totalWeight) * 100) : 0;

      consensusVerdict = `WEIGHTED CONSENSUS: ${topWeighted?.[0] || 'None'} (${percentage}% weighted score)`;
      break;
    }

    default:
      consensusVerdict = 'CONSENSUS: Unable to determine';
  }

  return `# Consensus Evaluation\n\n**Question:** ${question}\n\n**${consensusVerdict}**\n\n**Voting Strategy:** ${strategy}\n\n## Individual Responses\n\n${individualResponses}`;
}
