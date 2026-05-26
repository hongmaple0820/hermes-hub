import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/acrp/status
 * Update an ACRP agent's status.
 * Called by the skill-ws service when an ACRP agent sends agent:status.
 *
 * Body: {
 *   agentId: string;
 *   status: string;     // "online", "busy", "error"
 *   metrics?: object;   // { cpu, memory, uptime, taskCount, model }
 *   wsConnected?: boolean;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, status, metrics, wsConnected } = body

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: agentId' },
        { status: 400 },
      )
    }

    const agent = await db.agent.findUnique({
      where: { id: agentId },
    })

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 },
      )
    }

    const updateData: Record<string, any> = {}

    if (status) {
      updateData.status = status
    }

    if (wsConnected !== undefined) {
      updateData.wsConnected = wsConnected
    }

    if (metrics) {
      try {
        const existing = JSON.parse(agent.agentMetadata || '{}')
        updateData.agentMetadata = JSON.stringify({ ...existing, metrics })
      } catch {
        updateData.agentMetadata = JSON.stringify({ metrics })
      }
    }

    await db.agent.update({
      where: { id: agentId },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      agentId,
    })
  } catch (error: any) {
    console.error('[ACRP:Status] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Status update failed' },
      { status: 500 },
    )
  }
}
