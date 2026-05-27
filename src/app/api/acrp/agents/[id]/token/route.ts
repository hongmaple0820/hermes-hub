import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// DELETE /api/acrp/agents/[id]/token — Revoke an agent's ACRP token
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request)
    const { id: agentId } = await params

    // Verify agent exists and belongs to user
    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete all capabilities for this agent first
    await db.agentCapability.deleteMany({
      where: { agentId },
    })

    // Revoke token and mark as offline
    await db.agent.update({
      where: { id: agentId },
      data: {
        agentToken: null,
        wsConnected: false,
        status: 'offline',
      },
    })

    // Notify skill-ws to disconnect the agent's WebSocket
    try {
      await fetch('http://localhost:3004/internal/acrp-disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
        signal: AbortSignal.timeout(3000),
      })
    } catch (err) {
      console.warn('[ACRP] Failed to notify skill-ws for disconnect:', err)
      // Non-critical — agent will fail on next heartbeat since token is null
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ACRP] revoke token error:', error)
    return NextResponse.json(
      { error: 'Failed to revoke token' },
      { status: 500 }
    )
  }
}
