import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// DELETE /api/acrp/agents/[id]/token — Revoke an agent's ACRP token
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    // Verify agent exists
    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ACRP] revoke token error:', error)
    return NextResponse.json(
      { error: 'Failed to revoke token' },
      { status: 500 }
    )
  }
}
