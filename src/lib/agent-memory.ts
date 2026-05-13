/**
 * Agent Memory System for Hermes Hub
 *
 * Manages agent memory with three sections:
 * - memory: Long-term knowledge and facts the agent has learned
 * - user: User preferences and interaction history specific to this agent
 * - soul: Core personality traits and behavioral guidelines
 *
 * Memory is automatically injected into agent system prompts via
 * the buildMemoryContext() method, which is called from agent-reply.ts.
 *
 * Memory is persisted in the AgentMemory table (Prisma/SQLite).
 */

import { db } from '@/lib/db';
import { chatCompletion, type LLMProviderConfig } from '@/lib/llm-provider';

// ==================== Types ====================

export type MemorySection = 'memory' | 'user' | 'soul';

export interface MemoryEntry {
  id: string;
  agentId: string;
  section: MemorySection;
  content: string;
  modifiedAt: Date;
}

export interface MemorySearchResult {
  section: MemorySection;
  content: string;
  relevance: number; // 0-1, higher is more relevant
  matches: string[]; // matched keywords
}

export interface MemoryContext {
  hasMemory: boolean;
  soulContext: string;
  memoryContext: string;
  userContext: string;
  fullContext: string;
}

// ==================== MemoryManager Class ====================

export class MemoryManager {
  private agentId: string;
  private cache: Map<MemorySection, string> = new Map();
  private cacheLoaded: boolean = false;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  // --------------- Core CRUD Operations ---------------

  /**
   * Get the content of a specific memory section.
   * Returns empty string if the section doesn't exist yet.
   */
  async getMemory(section: MemorySection): Promise<string> {
    // Check cache first
    if (this.cache.has(section)) {
      return this.cache.get(section)!;
    }

    const record = await db.agentMemory.findUnique({
      where: {
        agentId_section: {
          agentId: this.agentId,
          section,
        },
      },
    });

    const content = record?.content || '';
    this.cache.set(section, content);
    return content;
  }

  /**
   * Update the entire content of a memory section.
   * Creates the section if it doesn't exist.
   */
  async updateMemory(section: MemorySection, content: string): Promise<MemoryEntry> {
    const record = await db.agentMemory.upsert({
      where: {
        agentId_section: {
          agentId: this.agentId,
          section,
        },
      },
      create: {
        agentId: this.agentId,
        section,
        content,
        modifiedAt: new Date(),
      },
      update: {
        content,
        modifiedAt: new Date(),
      },
    });

    // Update cache
    this.cache.set(section, content);

    return {
      id: record.id,
      agentId: record.agentId,
      section: record.section as MemorySection,
      content: record.content,
      modifiedAt: record.modifiedAt,
    };
  }

  /**
   * Append an entry to a memory section.
   * Entries are separated by newlines. Deduplication is performed
   * to avoid adding identical content.
   *
   * @param section - The memory section
   * @param entry - The entry to append
   * @returns The updated memory content
   */
  async appendToMemory(section: MemorySection, entry: string): Promise<string> {
    const currentContent = await this.getMemory(section);

    // Deduplication: check if the entry already exists (exact match or very similar)
    const lines = currentContent.split('\n').filter(line => line.trim());
    const normalizedEntry = entry.trim().toLowerCase();

    // Check for exact duplicate
    const isDuplicate = lines.some(line => line.trim().toLowerCase() === normalizedEntry);
    if (isDuplicate) {
      return currentContent;
    }

    // Check for very similar entries (one contains the other)
    const isSimilar = lines.some(line => {
      const normalizedLine = line.trim().toLowerCase();
      return normalizedLine.includes(normalizedEntry) || normalizedEntry.includes(normalizedLine);
    });

    if (isSimilar) {
      // Replace the similar entry with the new (potentially more detailed) one
      const newLines = lines.map(line => {
        const normalizedLine = line.trim().toLowerCase();
        if (normalizedEntry.includes(normalizedLine)) {
          return entry.trim();
        }
        return line;
      });
      const newContent = newLines.join('\n');
      await this.updateMemory(section, newContent);
      return newContent;
    }

    // Append new entry
    const separator = currentContent ? '\n' : '';
    const newContent = currentContent + separator + entry.trim();
    await this.updateMemory(section, newContent);
    return newContent;
  }

  // --------------- Search & Query ---------------

  /**
   * Search across all memory sections for relevant content.
   * Uses simple keyword matching with relevance scoring.
   *
   * @param query - The search query
   * @returns Array of search results sorted by relevance (highest first)
   */
  async searchMemory(query: string): Promise<MemorySearchResult[]> {
    const sections: MemorySection[] = ['memory', 'user', 'soul'];
    const results: MemorySearchResult[] = [];

    // Extract keywords from query
    const queryKeywords = this.extractKeywords(query);

    for (const section of sections) {
      const content = await this.getMemory(section);
      if (!content) continue;

      // Score each line by keyword matches
      const lines = content.split('\n').filter(line => line.trim());
      for (const line of lines) {
        const lineKeywords = this.extractKeywords(line);
        const matches = queryKeywords.filter(qk =>
          lineKeywords.some(lk => lk.includes(qk) || qk.includes(lk))
        );

        if (matches.length > 0) {
          const relevance = matches.length / queryKeywords.length;
          results.push({
            section,
            content: line,
            relevance,
            matches,
          });
        }
      }
    }

    // Sort by relevance (highest first)
    results.sort((a, b) => b.relevance - a.relevance);

    return results;
  }

  // --------------- Compression ---------------

  /**
   * Compress a memory section using LLM summarization.
   * Useful when memory grows too large. The LLM summarizes the content
   * while preserving important information.
   *
   * @param section - The memory section to compress
   * @returns The compressed content
   */
  async compressMemory(section: MemorySection): Promise<string> {
    const content = await this.getMemory(section);
    if (!content || content.length < 200) {
      // Too small to compress meaningfully
      return content;
    }

    // Try to get an LLM for compression
    const llmConfig = await this.getLLMConfig();
    if (!llmConfig) {
      // Fallback: simple truncation keeping most recent entries
      return this.simpleCompress(content);
    }

    try {
      const sectionDescriptions: Record<MemorySection, string> = {
        memory: 'long-term knowledge and facts the agent has learned',
        user: 'user preferences, traits, and interaction patterns',
        soul: 'core personality traits and behavioral guidelines',
      };

      const result = await chatCompletion(
        llmConfig,
        [
          {
            role: 'system',
            content: `You are a memory compression assistant. Compress the following ${section} memory (which contains ${sectionDescriptions[section]}) into a concise but complete summary. Preserve ALL important information, preferences, facts, and patterns. Remove redundancy but keep unique details. Use bullet points or numbered lists for clarity.`,
          },
          {
            role: 'user',
            content: `Compress this ${section} memory:\n\n${content}`,
          },
        ],
        undefined,
        { temperature: 0.3, maxTokens: 2048 }
      );

      const compressed = result.content.trim();
      if (compressed) {
        await this.updateMemory(section, compressed);
      }
      return compressed;
    } catch (error) {
      console.error('[MemoryManager] LLM compression failed, using simple compress:', error);
      return this.simpleCompress(content);
    }
  }

  // --------------- Context Building ---------------

  /**
   * Build a formatted memory context string for injection into agent prompts.
   * This is the main method used by agent-reply.ts to include memory in the system prompt.
   *
   * @returns Formatted memory context object
   */
  async buildMemoryContext(): Promise<MemoryContext> {
    const [soulContent, memoryContent, userContent] = await Promise.all([
      this.getMemory('soul'),
      this.getMemory('memory'),
      this.getMemory('user'),
    ]);

    const hasMemory = !!(soulContent || memoryContent || userContent);

    // Build soul context (personality & behavior)
    let soulContext = '';
    if (soulContent) {
      soulContext = `## Your Core Personality & Behavior\n${soulContent}`;
    }

    // Build memory context (knowledge & facts)
    let memoryContext = '';
    if (memoryContent) {
      memoryContext = `## Your Knowledge & Memory\n${memoryContent}`;
    }

    // Build user context (preferences & interaction history)
    let userContext = '';
    if (userContent) {
      userContext = `## User Preferences & History\n${userContent}`;
    }

    // Combine all context
    const parts: string[] = [];
    if (soulContext) parts.push(soulContext);
    if (memoryContext) parts.push(memoryContext);
    if (userContext) parts.push(userContext);

    const fullContext = hasMemory
      ? `\n\n--- Agent Memory ---\n${parts.join('\n\n')}\n--- End Agent Memory ---\n`
      : '';

    return {
      hasMemory,
      soulContext,
      memoryContext,
      userContext,
      fullContext,
    };
  }

  // --------------- Auto-learn from interactions ---------------

  /**
   * Automatically learn from a user-agent interaction.
   * Extracts relevant facts, preferences, and patterns from the conversation
   * and appends them to the appropriate memory sections.
   *
   * @param userMessage - The user's message
   * @param agentResponse - The agent's response
   */
  async learnFromInteraction(userMessage: string, agentResponse: string): Promise<void> {
    // Simple rule-based learning (no LLM call to avoid overhead on every message)
    const userLower = userMessage.toLowerCase();

    // Learn user preferences from explicit preference statements
    const preferencePatterns = [
      /i (?:prefer|like|want|love|enjoy|always|usually|never|hate|dislike) (.+?)(?:\.|!|$)/i,
      /my (?:favorite|preferred|default) (.+?) (?:is|are) (.+?)(?:\.|!|$)/i,
      /(?:please|could you|can you) (?:always|never|usually) (.+?)(?:\.|!|$)/i,
    ];

    for (const pattern of preferencePatterns) {
      const match = userLower.match(pattern);
      if (match) {
        await this.appendToMemory('user', `User preference: ${match[0].trim()}`);
      }
    }

    // Learn user name if they introduce themselves
    const nameMatch = userMessage.match(/(?:my name is|i'm|i am|call me) ([A-Z][a-z]+)/i);
    if (nameMatch) {
      await this.appendToMemory('user', `User's name: ${nameMatch[1]}`);
    }

    // Learn facts that the user explicitly states
    const factPatterns = [
      /(?:remember|note|keep in mind|don't forget) (?:that )?(.+?)(?:\.|!|$)/i,
      /(?:fyi|for your information|btw|by the way)[,:]?\s*(.+?)(?:\.|!|$)/i,
    ];

    for (const pattern of factPatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1].length > 5) {
        await this.appendToMemory('memory', match[1].trim());
      }
    }
  }

  // --------------- Utility Methods ---------------

  /**
   * Get all memory sections for an agent.
   */
  async getAllMemory(): Promise<Record<MemorySection, string>> {
    const [memory, user, soul] = await Promise.all([
      this.getMemory('memory'),
      this.getMemory('user'),
      this.getMemory('soul'),
    ]);

    return { memory, user, soul };
  }

  /**
   * Clear a specific memory section.
   */
  async clearMemory(section: MemorySection): Promise<void> {
    await this.updateMemory(section, '');
  }

  /**
   * Clear all memory for this agent.
   */
  async clearAllMemory(): Promise<void> {
    await Promise.all([
      this.clearMemory('memory'),
      this.clearMemory('user'),
      this.clearMemory('soul'),
    ]);
  }

  /**
   * Get memory statistics.
   */
  async getMemoryStats(): Promise<{
    sections: Record<MemorySection, { length: number; lineCount: number; lastModified: Date | null }>;
    totalSize: number;
  }> {
    const sections: Record<string, { length: number; lineCount: number; lastModified: Date | null }> = {};

    for (const section of ['memory', 'user', 'soul'] as MemorySection[]) {
      const content = await this.getMemory(section);
      const record = await db.agentMemory.findUnique({
        where: { agentId_section: { agentId: this.agentId, section } },
      });
      sections[section] = {
        length: content.length,
        lineCount: content ? content.split('\n').filter(l => l.trim()).length : 0,
        lastModified: record?.modifiedAt || null,
      };
    }

    const totalSize = Object.values(sections).reduce((sum, s) => sum + s.length, 0);

    return { sections: sections as Record<MemorySection, { length: number; lineCount: number; lastModified: Date | null }>, totalSize };
  }

  // --------------- Private Helpers ---------------

  /**
   * Extract keywords from text for search matching.
   */
  private extractKeywords(text: string): string[] {
    // Remove common stop words and extract meaningful keywords
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
      'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
      'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most',
      'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
      'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or',
      'if', 'while', 'about', 'up', 'it', 'its', 'i', 'me', 'my', 'we',
      'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they',
      'them', 'their', 'this', 'that', 'these', 'those', 'what', 'which',
      'who', 'whom',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Simple compression: keep the most recent entries and truncate.
   */
  private simpleCompress(content: string): string {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length <= 20) return content;

    // Keep first 5 lines (important context) and last 15 (recent)
    const kept = [...lines.slice(0, 5), '... (earlier entries compressed) ...', ...lines.slice(-15)];
    return kept.join('\n');
  }

  /**
   * Get an LLM config for memory compression.
   * Tries to find an active provider.
   */
  private async getLLMConfig(): Promise<LLMProviderConfig | null> {
    const agent = await db.agent.findUnique({
      where: { id: this.agentId },
      include: { provider: true },
    });

    if (agent?.provider) {
      return {
        provider: agent.provider.provider,
        apiKey: agent.provider.apiKey ?? undefined,
        baseUrl: agent.provider.baseUrl ?? undefined,
        defaultModel: agent.provider.defaultModel ?? undefined,
        config: JSON.parse(agent.provider.config || '{}'),
      };
    }

    // Try any active provider as fallback
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

  /**
   * Invalidate the internal cache.
   */
  invalidateCache(): void {
    this.cache.clear();
    this.cacheLoaded = false;
  }
}

// ==================== Convenience Functions ====================

/**
 * Get a MemoryManager instance for an agent.
 */
export function getMemoryManager(agentId: string): MemoryManager {
  return new MemoryManager(agentId);
}

/**
 * Quick helper to build memory context for an agent.
 * Returns the formatted context string suitable for injection into system prompts.
 */
export async function getAgentMemoryContext(agentId: string): Promise<MemoryContext> {
  const manager = new MemoryManager(agentId);
  return manager.buildMemoryContext();
}
