import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const type = url.searchParams.get('type') || 'all';

    const exportData: Record<string, unknown> = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: user.id,
    };

    if (type === 'all' || type === 'agents') {
      const agents = await db.agent.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          name: true,
          description: true,
          avatar: true,
          systemPrompt: true,
          mode: true,
          isPublic: true,
          status: true,
          providerId: true,
          model: true,
          temperature: true,
          maxTokens: true,
          callbackUrl: true,
          createdAt: true,
          updatedAt: true,
          config: true,
        },
      });
      exportData.agents = agents;
    }

    if (type === 'all' || type === 'skills') {
      const skills = await db.skill.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          name: true,
          displayName: true,
          description: true,
          category: true,
          handlerType: true,
          license: true,
          compatibility: true,
          metadata: true,
          allowedTools: true,
          instructions: true,
          parameters: true,
          configSchema: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      exportData.skills = skills;
    }

    if (type === 'all' || type === 'providers') {
      const providers = await db.lLMProvider.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          name: true,
          provider: true,
          // Mask API key for security
          apiKey: true,
          baseUrl: true,
          models: true,
          defaultModel: true,
          isActive: true,
          config: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      // Mask API keys
      exportData.providers = providers.map((p) => ({
        ...p,
        apiKey: p.apiKey ? '****' : null,
      }));
    }

    if (type === 'all' || type === 'conversations') {
      const conversations = await db.conversation.findMany({
        where: {
          participants: {
            some: { userId: user.id },
          },
        },
        select: {
          id: true,
          type: true,
          name: true,
          agentId: true,
          createdAt: true,
          updatedAt: true,
          messages: {
            select: {
              id: true,
              content: true,
              type: true,
              senderId: true,
              senderType: true,
              senderName: true,
              metadata: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      exportData.conversations = conversations;
    }

    const typeLabel = type === 'all' ? 'all-data' : type;
    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const csv = convertToCSV(exportData, type);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="hermes-hub-${typeLabel}-${timestamp}.csv"`,
        },
      });
    }

    // Default: JSON
    const json = JSON.stringify(exportData, null, 2);
    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="hermes-hub-${typeLabel}-${timestamp}.json"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Data export error:', error);
    return NextResponse.json(
      { error: 'Failed to export data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function convertToCSV(data: Record<string, unknown>, type: string): string {
  const sections: string[] = [];

  if (type === 'all' || type === 'agents') {
    const agents = (data.agents as Record<string, unknown>[]) || [];
    if (agents.length > 0) {
      sections.push('=== Agents ===');
      const headers = Object.keys(agents[0]).filter(k => k !== 'config');
      sections.push(headers.join(','));
      for (const agent of agents) {
        const row = headers.map((h) => {
          const val = agent[h];
          return escapeCSV(typeof val === 'string' ? val : val === null || val === undefined ? '' : String(val));
        });
        sections.push(row.join(','));
      }
      sections.push('');
    }
  }

  if (type === 'all' || type === 'skills') {
    const skills = (data.skills as Record<string, unknown>[]) || [];
    if (skills.length > 0) {
      sections.push('=== Skills ===');
      const headers = Object.keys(skills[0]).filter(k => !['parameters', 'configSchema', 'metadata', 'instructions', 'allowedTools'].includes(k));
      sections.push(headers.join(','));
      for (const skill of skills) {
        const row = headers.map((h) => {
          const val = skill[h];
          return escapeCSV(typeof val === 'string' ? val : val === null || val === undefined ? '' : String(val));
        });
        sections.push(row.join(','));
      }
      sections.push('');
    }
  }

  if (type === 'all' || type === 'providers') {
    const providers = (data.providers as Record<string, unknown>[]) || [];
    if (providers.length > 0) {
      sections.push('=== Providers ===');
      const headers = Object.keys(providers[0]).filter(k => !['models', 'config'].includes(k));
      sections.push(headers.join(','));
      for (const provider of providers) {
        const row = headers.map((h) => {
          const val = provider[h];
          return escapeCSV(typeof val === 'string' ? val : val === null || val === undefined ? '' : String(val));
        });
        sections.push(row.join(','));
      }
      sections.push('');
    }
  }

  if (type === 'all' || type === 'conversations') {
    const conversations = (data.conversations as Record<string, unknown>[]) || [];
    if (conversations.length > 0) {
      sections.push('=== Conversations ===');
      sections.push('conversationId,conversationName,type,createdAt');
      for (const conv of conversations) {
        sections.push(`${escapeCSV(String(conv.id))},${escapeCSV(String(conv.name || ''))},${escapeCSV(String(conv.type))},${escapeCSV(String(conv.createdAt))}`);
      }
      sections.push('');

      // Messages as separate section
      sections.push('=== Messages ===');
      sections.push('conversationId,messageId,content,type,senderType,senderName,createdAt');
      for (const conv of conversations) {
        const messages = (conv.messages as Record<string, unknown>[]) || [];
        for (const msg of messages) {
          sections.push(`${escapeCSV(String(conv.id))},${escapeCSV(String(msg.id))},${escapeCSV(String(msg.content))},${escapeCSV(String(msg.type))},${escapeCSV(String(msg.senderType))},${escapeCSV(String(msg.senderName || ''))},${escapeCSV(String(msg.createdAt))}`);
        }
      }
    }
  }

  return sections.join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
