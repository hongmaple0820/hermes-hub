/**
 * Conversation Lineage Tracking for Hermes Hub
 *
 * Tracks multi-session conversation chains. When a conversation gets too long
 * and is compressed, a new conversation is created with parentSessionId linking
 * back to the old one. The lineage field tracks the full chain of sessions.
 */

import { db } from '@/lib/db';
import { getConversationContext } from '@/lib/context-engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LineageEntry {
  sessionId: string;      // The conversation/session ID
  compressedAt: string;   // When this session was compressed
  messageCount: number;   // How many messages were in this session
}

export interface LineageInfo {
  current: {
    id: string;
    messageCount: number;
    parentSessionId?: string | null;
    createdAt: Date;
  };
  ancestors: LineageEntry[];
  totalMessages: number;  // Across all lineage
}

export interface ContinuationResult {
  newConversationId: string;
  carriedContext: string;  // The compressed context from previous conversation
}

export interface ContinuationCheck {
  isContinuation: boolean;
  parentSessionId?: string;
  lineageDepth: number;
}

// ---------------------------------------------------------------------------
// Get Conversation Lineage
// ---------------------------------------------------------------------------

export async function getConversationLineage(
  conversationId: string
): Promise<LineageInfo> {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Count messages in current conversation
  const messageCount = await db.message.count({
    where: { conversationId },
  });

  // Parse lineage from JSON
  const lineageEntries: LineageEntry[] = JSON.parse(conversation.lineage || '[]');

  // Calculate total messages across all lineage
  const totalMessages = lineageEntries.reduce((sum, entry) => sum + entry.messageCount, 0) + messageCount;

  return {
    current: {
      id: conversation.id,
      messageCount,
      parentSessionId: conversation.parentSessionId,
      createdAt: conversation.createdAt,
    },
    ancestors: lineageEntries,
    totalMessages,
  };
}

// ---------------------------------------------------------------------------
// Create a New Conversation that Continues from a Previous One
// ---------------------------------------------------------------------------

export async function continueConversation(
  previousConversationId: string,
  userId: string,
  agentId?: string
): Promise<ContinuationResult> {
  // Get the previous conversation
  const previousConversation = await db.conversation.findUnique({
    where: { id: previousConversationId },
  });

  if (!previousConversation) {
    throw new Error('Previous conversation not found');
  }

  // Get the compressed context from the previous conversation
  const contextResult = await getConversationContext(previousConversationId);

  // Count messages in previous conversation
  const previousMessageCount = await db.message.count({
    where: { conversationId: previousConversationId },
  });

  // Build lineage for the new conversation
  // Include the previous conversation's lineage entries + the previous conversation itself
  const previousLineage: LineageEntry[] = JSON.parse(previousConversation.lineage || '[]');

  const newLineageEntry: LineageEntry = {
    sessionId: previousConversationId,
    compressedAt: new Date().toISOString(),
    messageCount: previousMessageCount,
  };

  const newLineage = [...previousLineage, newLineageEntry];

  // Create the new conversation
  const newConversation = await db.conversation.create({
    data: {
      type: previousConversation.type,
      name: previousConversation.name,
      agentId: agentId || previousConversation.agentId,
      parentSessionId: previousConversationId,
      lineage: JSON.stringify(newLineage),
    },
  });

  // Add the user as a participant in the new conversation
  await db.conversationParticipant.create({
    data: {
      conversationId: newConversation.id,
      userId,
    },
  });

  return {
    newConversationId: newConversation.id,
    carriedContext: contextResult.context,
  };
}

// ---------------------------------------------------------------------------
// Detect if a Conversation is a Continuation
// ---------------------------------------------------------------------------

export function isContinuation(conversation: {
  parentSessionId?: string | null;
  lineage?: string;
}): ContinuationCheck {
  const lineageEntries: LineageEntry[] = JSON.parse(conversation.lineage || '[]');

  return {
    isContinuation: !!conversation.parentSessionId,
    parentSessionId: conversation.parentSessionId ?? undefined,
    lineageDepth: lineageEntries.length,
  };
}
