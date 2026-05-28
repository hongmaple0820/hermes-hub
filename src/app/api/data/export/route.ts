import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    // Support comma-separated types for selective export
    const typeParam = url.searchParams.get('type') || 'all';
    const selectedTypes = typeParam === 'all'
      ? ['agents', 'skills', 'providers', 'conversations']
      : typeParam.split(',').map(t => t.trim()).filter(Boolean);

    const exportData: Record<string, unknown> = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: user.id,
    };

    if (selectedTypes.includes('agents')) {
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
          // Include related data
          skills: {
            select: {
              skillId: true,
              config: true,
              isEnabled: true,
              priority: true,
              skill: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                },
              },
            },
          },
          connections: {
            select: {
              id: true,
              type: true,
              name: true,
              config: true,
              status: true,
              connectionMode: true,
            },
          },
          plugins: {
            select: {
              id: true,
              name: true,
              description: true,
              type: true,
              config: true,
              isEnabled: true,
            },
          },
        },
      });
      exportData.agents = agents;
    }

    if (selectedTypes.includes('skills')) {
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

    if (selectedTypes.includes('providers')) {
      const providers = await db.lLMProvider.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          name: true,
          provider: true,
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
      // Mask API keys for security — show only last 4 chars
      exportData.providers = providers.map((p) => ({
        ...p,
        apiKey: p.apiKey ? maskApiKey(p.apiKey) : null,
      }));
    }

    if (selectedTypes.includes('conversations')) {
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

    const typeLabel = typeParam === 'all' ? 'all-data' : typeParam.replace(/,/g, '-');
    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const csv = convertToCSV(exportData, selectedTypes);
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

/**
 * Mask API key: show only last 4 characters, replace rest with asterisks
 */
function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return '****';
  const visiblePart = apiKey.slice(-4);
  const maskedPart = '*'.repeat(Math.min(apiKey.length - 4, 20));
  return `${maskedPart}${visiblePart}`;
}

function convertToCSV(data: Record<string, unknown>, selectedTypes: string[]): string {
  const sections: string[] = [];

  if (selectedTypes.includes('agents')) {
    const agents = (data.agents as Record<string, unknown>[]) || [];
    if (agents.length > 0) {
      sections.push('=== Agents ===');
      const headers = Object.keys(agents[0]).filter(k => k !== 'config' && k !== 'skills' && k !== 'connections' && k !== 'plugins');
      sections.push(headers.join(','));
      for (const agent of agents) {
        const row = headers.map((h) => {
          const val = agent[h];
          return escapeCSV(typeof val === 'string' ? val : val === null || val === undefined ? '' : String(val));
        });
        sections.push(row.join(','));
      }

      // Agent Skills
      const allAgentSkills: { agentId: string; agentName: string; skillId: string; skillName: string; enabled: boolean; priority: number }[] = [];
      for (const agent of agents) {
        const skills = (agent.skills as Record<string, unknown>[]) || [];
        for (const s of skills) {
          const skill = (s.skill as Record<string, unknown>) || {};
          allAgentSkills.push({
            agentId: String(agent.id),
            agentName: String(agent.name),
            skillId: String(s.skillId),
            skillName: String(skill.displayName || skill.name || ''),
            enabled: Boolean(s.isEnabled),
            priority: Number(s.priority),
          });
        }
      }
      if (allAgentSkills.length > 0) {
        sections.push('');
        sections.push('=== Agent Skills ===');
        sections.push('agentId,agentName,skillId,skillName,enabled,priority');
        for (const as of allAgentSkills) {
          sections.push(`${escapeCSV(as.agentId)},${escapeCSV(as.agentName)},${escapeCSV(as.skillId)},${escapeCSV(as.skillName)},${as.enabled},${as.priority}`);
        }
      }

      // Agent Connections
      const allConnections: { agentId: string; agentName: string; connectionId: string; type: string; name: string; status: string }[] = [];
      for (const agent of agents) {
        const connections = (agent.connections as Record<string, unknown>[]) || [];
        for (const c of connections) {
          allConnections.push({
            agentId: String(agent.id),
            agentName: String(agent.name),
            connectionId: String(c.id),
            type: String(c.type),
            name: String(c.name || ''),
            status: String(c.status),
          });
        }
      }
      if (allConnections.length > 0) {
        sections.push('');
        sections.push('=== Agent Connections ===');
        sections.push('agentId,agentName,connectionId,type,name,status');
        for (const ac of allConnections) {
          sections.push(`${escapeCSV(ac.agentId)},${escapeCSV(ac.agentName)},${escapeCSV(ac.connectionId)},${escapeCSV(ac.type)},${escapeCSV(ac.name)},${escapeCSV(ac.status)}`);
        }
      }

      // Agent Plugins
      const allPlugins: { agentId: string; agentName: string; pluginId: string; name: string; type: string; enabled: boolean }[] = [];
      for (const agent of agents) {
        const plugins = (agent.plugins as Record<string, unknown>[]) || [];
        for (const p of plugins) {
          allPlugins.push({
            agentId: String(agent.id),
            agentName: String(agent.name),
            pluginId: String(p.id),
            name: String(p.name),
            type: String(p.type),
            enabled: Boolean(p.isEnabled),
          });
        }
      }
      if (allPlugins.length > 0) {
        sections.push('');
        sections.push('=== Agent Plugins ===');
        sections.push('agentId,agentName,pluginId,name,type,enabled');
        for (const ap of allPlugins) {
          sections.push(`${escapeCSV(ap.agentId)},${escapeCSV(ap.agentName)},${escapeCSV(ap.pluginId)},${escapeCSV(ap.name)},${escapeCSV(ap.type)},${ap.enabled}`);
        }
      }

      sections.push('');
    }
  }

  if (selectedTypes.includes('skills')) {
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

  if (selectedTypes.includes('providers')) {
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

  if (selectedTypes.includes('conversations')) {
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
