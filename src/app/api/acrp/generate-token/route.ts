import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// POST /api/acrp/generate-token — Generate an ACRP connection token for an agent
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const body = await request.json()
    const { agentId } = body

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    // Find the agent
    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Ownership check: agent must belong to the authenticated user
    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
