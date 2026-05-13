import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'acrp_internal_secret_2025'

/**
 * Check if the request comes from an internal service (skill-ws)
 * by verifying the x-internal-secret header.
 */
function isInternalRequest(request: NextRequest): boolean {
  const secret = request.headers.get('x-internal-secret')
  return !!secret && secret === INTERNAL_SECRET
}

/**
 * POST /api/acrp/status
 * Update an ACRP agent's status.
 * Called by the skill-ws service when an ACRP agent sends agent:status.
 *
 * Auth: Either x-internal-secret header (from skill-ws) OR requireAuth (from frontend)
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
    let userId: string | null = null

    // Dual auth: internal secret OR requireAuth
    if (isInternalRequest(request)) {
      // Internal call from skill-ws — no user auth needed
    } else {
      // Frontend call — require user authentication
      const user = await requireAuth(request)
      userId = user.id
    }

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

    // Ownership check for frontend calls
    if (userId && agent.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ACRP:Status] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Status update failed' },
      { status: 500 },
    )
  }
}
