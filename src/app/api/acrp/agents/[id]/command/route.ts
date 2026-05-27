import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/acrp/agents/[id]/command — Send a command to an agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request)
    const { id: agentId } = await params
    const body = await request.json()
    const { command, params: commandParams } = body

    if (!command) {
      return NextResponse.json(
        { error: 'command is required' },
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

    // Send command via skill-ws
    try {
      const wsRes = await fetch('http://localhost:3004/internal/acrp-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          type: 'command',
          data: {
            command,
            params: commandParams || {},
          },
        }),
        signal: AbortSignal.timeout(5000),
      })

      if (wsRes.status === 404) {
        return NextResponse.json(
          { success: false, error: 'Agent not connected', delivered: false },
          { status: 503 }
        )
      }

      if (!wsRes.ok) {
        console.warn('[ACRP] skill-ws notify responded with non-OK:', wsRes.status)
      }

      const wsData = await wsRes.json().catch(() => ({}))
      return NextResponse.json({
        success: true,
        commandId: wsData.commandId || null,
        delivered: true,
      })
    } catch (wsError) {
      console.warn('[ACRP] skill-ws notify failed:', wsError)
      return NextResponse.json(
        { error: 'Agent is not connected via WebSocket', success: false, delivered: false },
        { status: 503 }
      )
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ACRP] command error:', error)
    return NextResponse.json(
      { error: 'Failed to send command' },
      { status: 500 }
    )
  }
}
