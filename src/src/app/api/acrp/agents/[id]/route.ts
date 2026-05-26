import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/acrp/agents/[id] — Get single agent details with capabilities
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const agent = await db.agent.findUnique({
      where: { id },
      include: {
        capabilities: {
          orderBy: [{ category: 'asc' }, { uiHints: 'asc' }],
        },
      },
    })

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (!agent.agentToken) {
      return NextResponse.json(
        { error: 'Agent is not ACRP-enabled' },
        { status: 400 }
      )
    }

    // Get recent invocations (last 20)
    const recentInvocations = await db.capabilityInvocation.findMany({
      where: { agentId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // Get live status from skill-ws
    let liveStatus = null
    try {
      const res = await fetch(
        `http://localhost:3004/internal/acrp-status?agentId=${id}`,
        { signal: AbortSignal.timeout(3000) }
      )
      if (res.ok) {
        liveStatus = await res.json()
      }
    } catch {
      liveStatus = { connected: false }
    }

    return NextResponse.json({
      agent,
      capabilities: agent.capabilities,
      recentInvocations,
      liveStatus,
    })
  } catch (error) {
    console.error('[ACRP] agent detail error:', error)
    return NextResponse.json(
      { error: 'Failed to get agent details' },
      { status: 500 }
    )
  }
}
