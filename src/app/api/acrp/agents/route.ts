import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/acrp/agents — List all ACRP-connected agents with their capabilities
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Find all agents for this user that have an ACRP token
    const agents = await db.agent.findMany({
      where: {
        userId: user.id,
        agentToken: { not: null },
      },
      include: {
        capabilities: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get live status from skill-ws using the batch endpoint (fixes N+1 query problem)
    let batchStatus: Record<string, any> = {}
    try {
      const batchRes = await fetch(
        'http://localhost:3004/internal/acrp-status-batch',
        { signal: AbortSignal.timeout(3000) }
      )
      if (batchRes.ok) {
        const batchData = await batchRes.json()
        batchStatus = batchData.agents || {}
      }
    } catch {
      // skill-ws service may be down
    }

    // Get recent invocations for all agents in a single query
    const agentIds = agents.map(a => a.id)
    const recentInvocations = await db.capabilityInvocation.findMany({
      where: {
        agentId: { in: agentIds },
      },
      orderBy: { createdAt: 'desc' },
      take: agentIds.length * 5,
    })

    // Group invocations by agentId
    const invocationsByAgent = new Map<string, any[]>()
    for (const inv of recentInvocations) {
      const list = invocationsByAgent.get(inv.agentId) || []
      if (list.length < 5) {
        list.push(inv)
        invocationsByAgent.set(inv.agentId, list)
      }
    }

    // Augment agents with live status from batch result
    const agentsWithStatus = agents.map((agent) => {
      const liveStatus = batchStatus[agent.id] || { connected: false }

      return {
        id: agent.id,
        name: agent.name,
        agentType: agent.agentType,
        agentVersion: agent.agentVersion,
        agentPlatform: agent.agentPlatform,
        agentMetadata: agent.agentMetadata,
        wsConnected: agent.wsConnected,
        lastHeartbeatAt: agent.lastHeartbeatAt,
        registeredAt: agent.registeredAt,
        capabilities: agent.capabilities,
        recentInvocations: invocationsByAgent.get(agent.id) || [],
        liveStatus,
      }
    })

    return NextResponse.json({ agents: agentsWithStatus })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ACRP] agents list error:', error)
    return NextResponse.json(
      { error: 'Failed to list agents' },
      { status: 500 }
    )
  }
}
