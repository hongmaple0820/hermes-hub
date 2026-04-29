/**
 * Context Compression Engine for Hermes Hub
 *
 * Provides smart conversation context management with two compression paths:
 * - Path A (Incremental): When a snapshot exists, only compress new messages
 * - Path B (Full): When no snapshot exists, compress all messages
 *
 * Features:
 * - CJK-aware token estimation
 * - Tail message preservation (keeps N most recent messages verbatim)
 * - Per-room/configurable compression settings
 * - LLM-powered summarization
 */

import { db } from '@/lib/db';
import { chatCompletion, type LLMProviderConfig } from '@/lib/llm-provider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompressionConfig {
  triggerTokens: number;   // Token count that triggers compression (default: 100000)
  maxHistoryTokens: number; // Maximum tokens for compressed history (default: 32000)
  tailMessageCount: number; // Number of recent messages to keep verbatim (default: 20)
}

export interface ContextResult {
  context: string;
  wasCompressed: boolean;
  snapshotId?: string;
  tokenCount: number;
}

export interface CompressionResult {
  snapshotId: string;
  summaryTokenCount: number;
}

interface MessageRange {
  fromMessageId?: string;
  toMessageId?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
}

// ---------------------------------------------------------------------------
// Token Estimation (CJK-aware)
// ---------------------------------------------------------------------------

/**
 * Estimate token count for a text string.
 * CJK characters: ~1.5 tokens per character
 * Latin characters: ~0.25 tokens per character (4 chars per token)
 */
export function estimateTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    // CJK Unified Ideographs, Hiragana, Katakana, Hangul
    if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(char)) {
      tokens += 1.5;
    } else {
      tokens += 0.25;
    }
  }
  return Math.ceil(tokens);
}

// ---------------------------------------------------------------------------
// Default Config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: CompressionConfig = {
  triggerTokens: 100000,
  maxHistoryTokens: 32000,
  tailMessageCount: 20,
};

// ---------------------------------------------------------------------------
// Internal: Get LLM config for summarization
// ---------------------------------------------------------------------------

async function getLLMConfigForCompression(): Promise<LLMProviderConfig | null> {
  // Try to find an active provider for compression
  const provider = await db.lLMProvider.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!provider) return null;

  return {
    provider: provider.provider,
    apiKey: provider.apiKey ?? undefined,
    baseUrl: provider.baseUrl ?? undefined,
    defaultModel: provider.defaultModel ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Internal: Generate summary via LLM
// ---------------------------------------------------------------------------

async function generateSummary(messagesText: string): Promise<string> {
  const llmConfig = await getLLMConfigForCompression();

  if (!llmConfig) {
    // Fallback: create a simple truncation-based summary
    const maxLen = 8000;
    if (messagesText.length <= maxLen) return messagesText;
    return messagesText.substring(0, maxLen) + '\n\n[... conversation truncated due to length ...]';
  }

  try {
    const result = await chatCompletion(
      llmConfig,
      [
        {
          role: 'system',
          content:
            'You are a context compression assistant. Summarize the following conversation history into a concise summary that preserves all important information, decisions, and context. The summary should be detailed enough to serve as context for future messages.',
        },
        {
          role: 'user',
          content: `Conversation history:\n${messagesText}\n\nProvide a comprehensive summary:`,
        },
      ],
      undefined,
      { temperature: 0.3, maxTokens: 4096 }
    );
    return result.content;
  } catch (error) {
    console.error('[ContextEngine] LLM summarization failed, using fallback truncation:', error);
    // Fallback to truncation
    const maxLen = 8000;
    if (messagesText.length <= maxLen) return messagesText;
    return messagesText.substring(0, maxLen) + '\n\n[... conversation truncated due to length ...]';
  }
}

// ---------------------------------------------------------------------------
// Internal: Format messages for compression
// ---------------------------------------------------------------------------

function formatMessages(messages: Array<{ senderType: string; senderName?: string | null; content: string; createdAt: Date }>): string {
  return messages
    .map((m) => {
      const sender = m.senderType === 'user' ? (m.senderName || 'User') : (m.senderName || 'Agent');
      return `[${sender}]: ${m.content}`;
    })
    .join('\n');
}

function formatRoomMessages(messages: Array<{ senderInfo: string; content: string; createdAt: Date }>): string {
  return messages
    .map((m) => {
      let senderName = 'Unknown';
      try {
        const info = JSON.parse(m.senderInfo);
        senderName = info.name || 'Unknown';
      } catch {
        // use default
      }
      return `[${senderName}]: ${m.content}`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Internal: Create a snapshot
// ---------------------------------------------------------------------------

async function createSnapshot(
  type: 'conversation' | 'room',
  id: string,
  summary: string,
  messageRange: MessageRange,
  compressionType: 'full' | 'incremental'
): Promise<string> {
  const tokenCount = estimateTokens(summary);

  const snapshot = await db.contextSnapshot.create({
    data: {
      roomId: type === 'room' ? id : null,
      conversationId: type === 'conversation' ? id : null,
      summary,
      messageRange: JSON.stringify(messageRange),
      tokenCount,
      compressionType,
    },
  });

  return snapshot.id;
}

// ---------------------------------------------------------------------------
// Internal: Get latest snapshot
// ---------------------------------------------------------------------------

async function getLatestSnapshot(
  type: 'conversation' | 'room',
  id: string
): Promise<{ id: string; summary: string; tokenCount: number; messageRange: string; compressionType: string; createdAt: Date } | null> {
  const where = type === 'conversation' ? { conversationId: id } : { roomId: id };

  const snapshots = await db.contextSnapshot.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  return snapshots[0] || null;
}

// ---------------------------------------------------------------------------
// Get Conversation Context (with compression if needed)
// ---------------------------------------------------------------------------

export async function getConversationContext(
  conversationId: string,
  triggerTokens?: number,
  maxHistoryTokens?: number,
  tailMessageCount?: number
): Promise<ContextResult> {
  const config: CompressionConfig = {
    triggerTokens: triggerTokens ?? DEFAULT_CONFIG.triggerTokens,
    maxHistoryTokens: maxHistoryTokens ?? DEFAULT_CONFIG.maxHistoryTokens,
    tailMessageCount: tailMessageCount ?? DEFAULT_CONFIG.tailMessageCount,
  };

  // Get all messages
  const messages = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });

  if (messages.length === 0) {
    return { context: '', wasCompressed: false, tokenCount: 0 };
  }

  // Estimate total tokens
  const allText = formatMessages(messages);
  const totalTokens = estimateTokens(allText);

  // Get existing snapshot
  const latestSnapshot = await getLatestSnapshot('conversation', conversationId);

  if (latestSnapshot) {
    // Path A: Incremental compression
    const range: MessageRange = JSON.parse(latestSnapshot.messageRange || '{}');
    const lastCompressedTimestamp = range.toTimestamp ? new Date(range.toTimestamp) : null;

    // Get new messages since last snapshot
    const newMessages = lastCompressedTimestamp
      ? messages.filter((m) => new Date(m.createdAt) > lastCompressedTimestamp)
      : messages;

    const newText = formatMessages(newMessages);
    const newTokens = estimateTokens(newText);

    // Check if we need to compress
    const combinedTokens = latestSnapshot.tokenCount + newTokens;

    if (combinedTokens < config.triggerTokens) {
      // Under threshold: return snapshot + new messages
      const context = latestSnapshot.summary + '\n\n--- Recent Messages ---\n' + newText;
      return {
        context,
        wasCompressed: true,
        snapshotId: latestSnapshot.id,
        tokenCount: estimateTokens(context),
      };
    }

    // Over threshold: need incremental compression
    const allOldText = latestSnapshot.summary + '\n\n--- New Messages ---\n' + newText;
    const summary = await generateSummary(allOldText);

    // Keep tail messages verbatim
    const tailMessages = messages.slice(-config.tailMessageCount);
    const tailText = formatMessages(tailMessages);

    const messageRange: MessageRange = {
      fromMessageId: messages[0]?.id,
      toMessageId: messages[messages.length - 1]?.id,
      fromTimestamp: messages[0]?.createdAt.toISOString(),
      toTimestamp: messages[messages.length - 1]?.createdAt.toISOString(),
    };

    const snapshotId = await createSnapshot('conversation', conversationId, summary, messageRange, 'incremental');

    const context = summary + '\n\n--- Recent Messages (verbatim) ---\n' + tailText;
    return {
      context,
      wasCompressed: true,
      snapshotId,
      tokenCount: estimateTokens(context),
    };
  }

  // Path B: Full compression (no existing snapshot)
  if (totalTokens < config.triggerTokens) {
    // Under threshold: return messages verbatim
    return {
      context: allText,
      wasCompressed: false,
      tokenCount: totalTokens,
    };
  }

  // Over threshold: full compression
  const summary = await generateSummary(allText);

  // Keep tail messages verbatim
  const tailMessages = messages.slice(-config.tailMessageCount);
  const tailText = formatMessages(tailMessages);

  const messageRange: MessageRange = {
    fromMessageId: messages[0]?.id,
    toMessageId: messages[messages.length - 1]?.id,
    fromTimestamp: messages[0]?.createdAt.toISOString(),
    toTimestamp: messages[messages.length - 1]?.createdAt.toISOString(),
  };

  const snapshotId = await createSnapshot('conversation', conversationId, summary, messageRange, 'full');

  const context = summary + '\n\n--- Recent Messages (verbatim) ---\n' + tailText;
  return {
    context,
    wasCompressed: true,
    snapshotId,
    tokenCount: estimateTokens(context),
  };
}

// ---------------------------------------------------------------------------
// Get Room Context (with compression if needed)
// ---------------------------------------------------------------------------

export async function getRoomContext(
  roomId: string,
  triggerTokens?: number,
  maxHistoryTokens?: number,
  tailMessageCount?: number
): Promise<ContextResult> {
  // Get room's compression config
  const room = await db.chatRoom.findUnique({ where: { id: roomId } });
  const config: CompressionConfig = {
    triggerTokens: triggerTokens ?? room?.triggerTokens ?? DEFAULT_CONFIG.triggerTokens,
    maxHistoryTokens: maxHistoryTokens ?? room?.maxHistoryTokens ?? DEFAULT_CONFIG.maxHistoryTokens,
    tailMessageCount: tailMessageCount ?? DEFAULT_CONFIG.tailMessageCount,
  };

  // Get all messages
  const messages = await db.chatRoomMessage.findMany({
    where: { roomId },
    orderBy: { createdAt: 'asc' },
  });

  if (messages.length === 0) {
    return { context: '', wasCompressed: false, tokenCount: 0 };
  }

  // Estimate total tokens
  const allText = formatRoomMessages(messages);
  const totalTokens = estimateTokens(allText);

  // Get existing snapshot
  const latestSnapshot = await getLatestSnapshot('room', roomId);

  if (latestSnapshot) {
    // Path A: Incremental compression
    const range: MessageRange = JSON.parse(latestSnapshot.messageRange || '{}');
    const lastCompressedTimestamp = range.toTimestamp ? new Date(range.toTimestamp) : null;

    const newMessages = lastCompressedTimestamp
      ? messages.filter((m) => new Date(m.createdAt) > lastCompressedTimestamp)
      : messages;

    const newText = formatRoomMessages(newMessages);
    const newTokens = estimateTokens(newText);

    const combinedTokens = latestSnapshot.tokenCount + newTokens;

    if (combinedTokens < config.triggerTokens) {
      const context = latestSnapshot.summary + '\n\n--- Recent Messages ---\n' + newText;
      return {
        context,
        wasCompressed: true,
        snapshotId: latestSnapshot.id,
        tokenCount: estimateTokens(context),
      };
    }

    // Need incremental compression
    const allOldText = latestSnapshot.summary + '\n\n--- New Messages ---\n' + newText;
    const summary = await generateSummary(allOldText);

    const tailMessages = messages.slice(-config.tailMessageCount);
    const tailText = formatRoomMessages(tailMessages);

    const messageRange: MessageRange = {
      fromMessageId: messages[0]?.id,
      toMessageId: messages[messages.length - 1]?.id,
      fromTimestamp: messages[0]?.createdAt.toISOString(),
      toTimestamp: messages[messages.length - 1]?.createdAt.toISOString(),
    };

    const snapshotId = await createSnapshot('room', roomId, summary, messageRange, 'incremental');

    const context = summary + '\n\n--- Recent Messages (verbatim) ---\n' + tailText;
    return {
      context,
      wasCompressed: true,
      snapshotId,
      tokenCount: estimateTokens(context),
    };
  }

  // Path B: Full compression
  if (totalTokens < config.triggerTokens) {
    return {
      context: allText,
      wasCompressed: false,
      tokenCount: totalTokens,
    };
  }

  const summary = await generateSummary(allText);

  const tailMessages = messages.slice(-config.tailMessageCount);
  const tailText = formatRoomMessages(tailMessages);

  const messageRange: MessageRange = {
    fromMessageId: messages[0]?.id,
    toMessageId: messages[messages.length - 1]?.id,
    fromTimestamp: messages[0]?.createdAt.toISOString(),
    toTimestamp: messages[messages.length - 1]?.createdAt.toISOString(),
  };

  const snapshotId = await createSnapshot('room', roomId, summary, messageRange, 'full');

  const context = summary + '\n\n--- Recent Messages (verbatim) ---\n' + tailText;
  return {
    context,
    wasCompressed: true,
    snapshotId,
    tokenCount: estimateTokens(context),
  };
}

// ---------------------------------------------------------------------------
// Force Compress
// ---------------------------------------------------------------------------

export async function forceCompress(
  type: 'conversation' | 'room',
  id: string
): Promise<CompressionResult> {
  if (type === 'conversation') {
    const messages = await db.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });

    if (messages.length === 0) {
      const snapshotId = await createSnapshot('conversation', id, 'Empty conversation', {}, 'full');
      return { snapshotId, summaryTokenCount: 0 };
    }

    const allText = formatMessages(messages);
    const summary = await generateSummary(allText);
    const tailMessages = messages.slice(-DEFAULT_CONFIG.tailMessageCount);
    const tailText = formatMessages(tailMessages);

    const messageRange: MessageRange = {
      fromMessageId: messages[0]?.id,
      toMessageId: messages[messages.length - 1]?.id,
      fromTimestamp: messages[0]?.createdAt.toISOString(),
      toTimestamp: messages[messages.length - 1]?.createdAt.toISOString(),
    };

    const snapshotId = await createSnapshot('conversation', id, summary, messageRange, 'full');
    const summaryTokenCount = estimateTokens(summary + '\n\n--- Recent Messages (verbatim) ---\n' + tailText);

    return { snapshotId, summaryTokenCount };
  } else {
    const messages = await db.chatRoomMessage.findMany({
      where: { roomId: id },
      orderBy: { createdAt: 'asc' },
    });

    if (messages.length === 0) {
      const snapshotId = await createSnapshot('room', id, 'Empty room', {}, 'full');
      return { snapshotId, summaryTokenCount: 0 };
    }

    const allText = formatRoomMessages(messages);
    const summary = await generateSummary(allText);
    const tailMessages = messages.slice(-DEFAULT_CONFIG.tailMessageCount);
    const tailText = formatRoomMessages(tailMessages);

    const messageRange: MessageRange = {
      fromMessageId: messages[0]?.id,
      toMessageId: messages[messages.length - 1]?.id,
      fromTimestamp: messages[0]?.createdAt.toISOString(),
      toTimestamp: messages[messages.length - 1]?.createdAt.toISOString(),
    };

    const snapshotId = await createSnapshot('room', id, summary, messageRange, 'full');
    const summaryTokenCount = estimateTokens(summary + '\n\n--- Recent Messages (verbatim) ---\n' + tailText);

    return { snapshotId, summaryTokenCount };
  }
}

// ---------------------------------------------------------------------------
// Build LLM Context (used by agent reply)
// ---------------------------------------------------------------------------

export async function buildLLMContext(
  type: 'conversation' | 'room',
  id: string,
  systemPrompt: string,
  newMessage: string
): Promise<{ messages: Array<{ role: string; content: string }> }> {
  // Get context with compression
  const contextResult = type === 'conversation'
    ? await getConversationContext(id)
    : await getRoomContext(id);

  const messages: Array<{ role: string; content: string }> = [];

  // System prompt
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  // If context was compressed, add it as a system message
  if (contextResult.wasCompressed && contextResult.context) {
    messages.push({
      role: 'system',
      content: `[Previous conversation context (compressed)]:\n${contextResult.context}`,
    });
  } else if (contextResult.context) {
    // Parse the verbatim messages and add them as user/assistant turns
    const lines = contextResult.context.split('\n');
    for (const line of lines) {
      const match = line.match(/^\[(User|Agent|[^[\]]+)\]:\s*(.*)$/);
      if (match) {
        const sender = match[1];
        const content = match[2];
        if (sender === 'User') {
          messages.push({ role: 'user', content });
        } else {
          messages.push({ role: 'assistant', content });
        }
      }
    }
  }

  // Add the new user message
  messages.push({ role: 'user', content: newMessage });

  return { messages };
}

// ---------------------------------------------------------------------------
// Get Context Stats
// ---------------------------------------------------------------------------

export async function getContextStats(
  type: 'conversation' | 'room',
  id: string
): Promise<{
  totalMessages: number;
  estimatedTokens: number;
  hasSnapshot: boolean;
  snapshotSummary?: string;
  compressionType?: string;
  snapshotTokenCount?: number;
}> {
  let totalMessages = 0;
  let allText = '';

  if (type === 'conversation') {
    const messages = await db.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });
    totalMessages = messages.length;
    allText = formatMessages(messages);
  } else {
    const messages = await db.chatRoomMessage.findMany({
      where: { roomId: id },
      orderBy: { createdAt: 'asc' },
    });
    totalMessages = messages.length;
    allText = formatRoomMessages(messages);
  }

  const estimatedTokens = estimateTokens(allText);
  const latestSnapshot = await getLatestSnapshot(type, id);

  return {
    totalMessages,
    estimatedTokens,
    hasSnapshot: !!latestSnapshot,
    snapshotSummary: latestSnapshot?.summary?.substring(0, 200),
    compressionType: latestSnapshot?.compressionType,
    snapshotTokenCount: latestSnapshot?.tokenCount,
  };
}
