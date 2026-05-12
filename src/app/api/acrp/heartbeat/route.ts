import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/acrp/heartbeat
 * Process an ACRP agent heartbeat.
 * Called by the skill-ws service when an ACRP agent sends agent:heartbeat.
 *
 * Body: {
 *   agentId: string;
 *   status?: string;
 *   metrics?: object;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, status, metrics } = body

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

    // Update the agent's heartbeat timestamp and status
    const updateData: Record<string, any> = {
      lastHeartbeatAt: new Date(),
      wsConnected: true,
    }

    if (status) {
      updateData.status = status
    }

    if (metrics) {
      // Merge metrics into agentMetadata
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
      nextInterval: 30,
    })
  } catch (error: any) {
    console.error('[ACRP:Heartbeat] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Heartbeat processing failed' },
      { status: 500 },
    )
  }
}
