import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const agent = await db.agent.findUnique({
      where: { id },
      include: {
        provider: { select: { id: true, name: true, provider: true, defaultModel: true, isActive: true } },
        skills: { include: { skill: true }, orderBy: { priority: 'asc' } },
        connections: true,
        plugins: true,
        capabilities: { orderBy: { category: 'asc' } },
        memories: true,
        template: true,
      },
    });

    if (!agent || agent.userId !== user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const unifiedSkills = [
      ...agent.skills.map(as => ({
        id: as.id,
        skillId: as.skillId,
        name: as.skill.name,
        displayName: as.skill.displayName,
        description: as.skill.description,
        category: as.skill.category,
        icon: as.skill.icon,
        handlerType: as.skill.handlerType,
        isEnabled: as.isEnabled,
        priority: as.priority,
        invokeCount: as.invokeCount,
        lastInvokedAt: as.lastInvokedAt,
        sourceLabel: as.skill.handlerType === 'acrp' ? 'ACRP Auto' :
                     as.skill.handlerType === 'protocol' ? 'Protocol' :
                     as.skill.handlerType === 'webhook' ? 'Webhook' : 'Builtin',
      })),
      ...agent.plugins.map(p => ({
        id: p.id,
        skillId: null,
        name: p.name,
        displayName: p.name,
        description: p.description || '',
        category: 'general',
        icon: null,
        handlerType: p.type === 'hermes-protocol' ? 'protocol' : p.type,
        isEnabled: p.isEnabled,
        priority: 100,
        invokeCount: 0,
        lastInvokedAt: null,
        sourceLabel: p.type === 'hermes-protocol' ? 'Protocol' : p.type,
      })),
    ];

    const connectionStatus = agent.mode === 'acrp'
      ? { type: 'websocket', connected: agent.wsConnected, lastActivity: agent.lastHeartbeatAt?.toISOString() || null }
      : { type: 'llm', connected: agent.provider?.isActive ?? false, lastActivity: null };

    const recentMessages = await db.message.findMany({
      where: { conversation: { agentId: agent.id } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, content: true, type: true, senderType: true, senderName: true, createdAt: true },
    });

    const recentInvocations = await db.capabilityInvocation.findMany({
      where: { agentId: agent.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const activities = [
      ...recentMessages.map(m => ({
        id: m.id,
        type: 'message',
        content: m.content,
        senderType: m.senderType,
        senderName: m.senderName,
        createdAt: m.createdAt.toISOString(),
      })),
      ...recentInvocations.map(i => ({
        id: i.id,
        type: 'capability_invocation',
        capabilityId: i.capabilityId,
        status: i.status,
        duration: i.duration,
        createdAt: i.createdAt.toISOString(),
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20);

    return NextResponse.json({
      agent,
      skills: unifiedSkills,
      connectionStatus,
      recentActivities: activities,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get unified detail error:', error);
    return NextResponse.json({ error: 'Failed to get agent detail' }, { status: 500 });
  }
}