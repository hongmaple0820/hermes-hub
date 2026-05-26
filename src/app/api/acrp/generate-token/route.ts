import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/acrp/generate-token — Generate an ACRP connection token for an agent
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const { agentId } = body

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    // Find the agent and verify ownership
    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Generate a unique token prefixed with "acrp_"
    const token = `acrp_${crypto.randomUUID()}`

    // Update agent with the new token and registration timestamp
    await db.agent.update({
      where: { id: agentId },
      data: {
        agentToken: token,
        registeredAt: new Date(),
      },
    })

    return NextResponse.json({
      agentToken: token,
      wsConnectUrl: '/?XTransformPort=3004',
      wsDirectUrl: 'ws://localhost:3004/',
      agentId,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ACRP] generate-token error:', error)
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    )
  }
}
