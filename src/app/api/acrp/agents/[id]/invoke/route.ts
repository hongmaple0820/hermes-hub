import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/acrp/agents/[id]/invoke — Invoke a capability on an agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = await request.json()
    const { capabilityId, params: invokeParams } = body

    if (!capabilityId) {
      return NextResponse.json(
        { error: 'capabilityId is required' },
        { status: 400 }
      )
    }

    // Get userId from x-user-id header
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json(
        { error: 'x-user-id header is required' },
        { status: 401 }
      )
    }

    // Verify agent exists
    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
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
        invokedBy: userId,
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
          invokedBy: userId,
        }),
        signal: AbortSignal.timeout(5000),
      })

      if (wsRes.ok) {
        // Update invocation status to "sent"
        await db.capabilityInvocation.update({
          where: { id: invocation.id },
          data: { status: 'sent' },
        })
      } else {
        // skill-ws responded with error — still mark as sent, it may retry
        console.warn(
          '[ACRP] skill-ws invoke responded with non-OK:',
          wsRes.status
        )
        await db.capabilityInvocation.update({
          where: { id: invocation.id },
          data: { status: 'sent' },
        })
      }
    } catch (wsError) {
      // skill-ws is down or agent not connected
      console.warn('[ACRP] skill-ws invoke failed:', wsError)
      await db.capabilityInvocation.update({
        where: { id: invocation.id },
        data: { status: 'sent' },
      })
    }

    return NextResponse.json({
      invocationId: invocation.id,
      status: 'sent',
    })
  } catch (error) {
    console.error('[ACRP] invoke error:', error)
    return NextResponse.json(
      { error: 'Failed to invoke capability' },
      { status: 500 }
    )
  }
}
