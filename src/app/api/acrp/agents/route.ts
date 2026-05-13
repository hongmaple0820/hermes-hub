import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/acrp/agents — List all ACRP-connected agents with their capabilities
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Use the authenticated user's ID instead of query param
    const userId = user.id

    // Find all agents for this user that have an ACRP token
    const agents = await db.agent.findMany({
      where: {
        userId,
        agentToken: { not: null },
      },
      include: {
        capabilities: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get live status from skill-ws for each agent
    const agentsWithStatus = await Promise.all(
      agents.map(async (agent) => {
        let liveStatus = null
        try {
          const res = await fetch(
            `http://localhost:3004/internal/acrp-status?agentId=${agent.id}`,
            { signal: AbortSignal.timeout(3000) }
          )
          if (res.ok) {
            liveStatus = await res.json()
          }
        } catch {
          // skill-ws service may be down or agent not connected
          liveStatus = { connected: false }
        }

        // Get latest 5 invocations for this agent
        const recentInvocations = await db.capabilityInvocation.findMany({
          where: { agentId: agent.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })

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
          recentInvocations,
          liveStatus,
        }
      })
    )

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
