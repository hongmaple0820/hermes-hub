import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/acrp/agents/[id]/command — Send a command to an agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = await request.json()
    const { command, params: commandParams } = body

    if (!command) {
      return NextResponse.json(
        { error: 'command is required' },
        { status: 400 }
      )
    }

    // Verify agent exists
    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
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

      if (!wsRes.ok) {
        console.warn('[ACRP] skill-ws notify responded with non-OK:', wsRes.status)
      }
    } catch (wsError) {
      console.warn('[ACRP] skill-ws notify failed:', wsError)
      return NextResponse.json(
        { error: 'Agent is not connected via WebSocket', success: false },
        { status: 503 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ACRP] command error:', error)
    return NextResponse.json(
      { error: 'Failed to send command' },
      { status: 500 }
    )
  }
}
