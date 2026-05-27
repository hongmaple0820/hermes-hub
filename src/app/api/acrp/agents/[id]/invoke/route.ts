import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/acrp/agents/[id]/invoke — Invoke a capability on an agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request)
    const { id: agentId } = await params
    const body = await request.json()
    const { capabilityId, params: invokeParams } = body

    if (!capabilityId) {
      return NextResponse.json(
        { error: 'capabilityId is required' },
        { status: 400 }
      )
    }

    // Verify agent exists and belongs to user
    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify capability exists
    const capability = await db.agentCapability.findUnique({
      where: {
        agentId_capabilityId: {
          agentId,
          capabilityId,
        },
      },
    })
    if (!capability) {
      return NextResponse.json(
        { error: 'Capability not found' },
        { status: 404 }
      )
    }

    if (!capability.isEnabled) {
      return NextResponse.json(
        { error: 'Capability is disabled' },
        { status: 400 }
      )
    }

    // Create invocation record
    const invocation = await db.capabilityInvocation.create({
      data: {
        agentId,
        capabilityId,
        invokedBy: user.id,
        params: JSON.stringify(invokeParams || {}),
        status: 'pending',
      },
    })

    // Try to invoke via skill-ws
    try {
      const wsRes = await fetch('http://localhost:3004/internal/acrp-invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          capabilityId,
          params: invokeParams || {},
          invocationId: invocation.id,
          invokedBy: user.id,
        }),
        signal: AbortSignal.timeout(5000),
      })

      if (wsRes.ok) {
        // Update invocation status to "sent"
        await db.capabilityInvocation.update({
          where: { id: invocation.id },
          data: { status: 'sent' },
        })
        return NextResponse.json({
          invocationId: invocation.id,
          status: 'sent',
        })
      } else if (wsRes.status === 404) {
        // Agent not connected
        await db.capabilityInvocation.update({
          where: { id: invocation.id },
          data: { status: 'failed', error: 'Agent not connected', completedAt: new Date() },
        })
        return NextResponse.json(
          { error: 'Agent is not connected', invocationId: invocation.id, status: 'failed' },
          { status: 503 }
        )
      } else {
        // Other skill-ws error
        const errBody = await wsRes.text().catch(() => 'Unknown error')
        await db.capabilityInvocation.update({
          where: { id: invocation.id },
          data: { status: 'failed', error: `Invocation delivery failed: ${errBody}`, completedAt: new Date() },
        })
        return NextResponse.json(
          { error: 'Failed to deliver invocation', invocationId: invocation.id, status: 'failed' },
          { status: 502 }
        )
      }
    } catch (wsError) {
      // skill-ws is down
      console.warn('[ACRP] skill-ws invoke failed:', wsError)
      await db.capabilityInvocation.update({
        where: { id: invocation.id },
        data: { status: 'failed', error: 'Service unavailable', completedAt: new Date() },
      })
      return NextResponse.json(
        { error: 'Skill service unavailable', invocationId: invocation.id, status: 'failed' },
        { status: 503 }
      )
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ACRP] invoke error:', error)
    return NextResponse.json(
      { error: 'Failed to invoke capability' },
      { status: 500 }
    )
  }
}
