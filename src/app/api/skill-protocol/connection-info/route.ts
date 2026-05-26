import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * GET /api/skill-protocol/connection-info
 * Returns the WebSocket connection information for a given agent+skill binding.
 *
 * Query: ?agentId={agentId}&skillId={skillId}
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const agentId = request.nextUrl.searchParams.get('agentId')
    const skillId = request.nextUrl.searchParams.get('skillId')

    if (!agentId || !skillId) {
      return NextResponse.json({ error: 'Missing agentId or skillId' }, { status: 400 })
    }

    // Verify the agent belongs to the authenticated user
    const agent = await db.agent.findFirst({
      where: { id: agentId, userId: user.id },
    })
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const agentSkill = await db.agentSkill.findUnique({
      where: { agentId_skillId: { agentId, skillId } },
    })
    if (!agentSkill) {
      return NextResponse.json({ error: 'Binding not found' }, { status: 404 })
    }

    // Check WS connection status via skill-ws service
    let wsStatus: { connected: boolean; lastHeartbeat: string | null; socketId?: string } = {
      connected: false,
      lastHeartbeat: null,
    }
    try {
      const res = await fetch(
        `http://localhost:3004/internal/status?agentId=${agentId}&skillId=${skillId}`,
      )
      if (res.ok) {
        wsStatus = await res.json()
      }
    } catch {
      // skill-ws service may not be running
    }

    return NextResponse.json({
      endpointToken: agentSkill.endpointToken,
      callbackUrl: agentSkill.callbackUrl,
      callbackSecret: agentSkill.callbackSecret,
      wsConnected: agentSkill.wsConnected,
      wsStatus,
      wsConnectUrl: agentSkill.endpointToken ? '/?XTransformPort=3004' : null,
      connectionMode: 'websocket',
    })
  } catch (error: any) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[SkillProtocol:ConnectionInfo] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get connection info' },
      { status: 500 },
    )
  }
}
