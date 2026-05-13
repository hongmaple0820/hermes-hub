import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// Helper: push notification for capability invocation
async function pushCapabilityNotification(userId: string, agentName: string, capabilityName: string, agentId: string) {
  try {
    const dbNotif = await db.notification.create({
      data: {
        userId,
        type: 'capability_result',
        title: 'Capability completed',
        message: `Capability "${capabilityName}" on agent "${agentName}" has been invoked.`,
        actionUrl: `/agents/${agentId}`,
      },
    })
    await fetch('http://localhost:3003/internal/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        notification: {
          id: dbNotif.id,
          type: 'capability_result',
          title: 'Capability completed',
          message: `Capability "${capabilityName}" on agent "${agentName}" has been invoked.`,
          actionUrl: `/agents/${agentId}`,
          timestamp: dbNotif.createdAt.toISOString(),
        },
      }),
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    // Silently fail — notifications are non-critical
  }
}

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

    // Verify agent exists
    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Ownership check: agent must belong to the authenticated user
    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Push notification for capability invocation (fire-and-forget)
    pushCapabilityNotification(user.id, agent.name, capability.name, agentId)

    return NextResponse.json({
      invocationId: invocation.id,
      status: 'sent',
    })
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
