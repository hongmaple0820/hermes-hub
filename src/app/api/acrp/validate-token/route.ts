import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/acrp/validate-token
 * Validate an agentToken and return agent info.
 * Used by the skill-ws WebSocket server to authenticate ACRP connections.
 *
 * Query: ?token={agentToken}
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Missing token parameter' },
        { status: 400 },
      )
    }

    const agent = await db.agent.findUnique({
      where: { agentToken: token },
      select: {
        id: true,
        name: true,
        agentType: true,
        agentVersion: true,
        agentPlatform: true,
        status: true,
        agentToken: true,
      },
    })

    if (!agent) {
      return NextResponse.json(
        { valid: false, error: 'Invalid agent token' },
        { status: 401 },
      )
    }

    return NextResponse.json({
      valid: true,
      agentId: agent.id,
      name: agent.name,
      agentType: agent.agentType || 'custom',
      agentVersion: agent.agentVersion,
      agentPlatform: agent.agentPlatform,
      status: agent.status,
    })
  } catch (error: any) {
    console.error('[ACRP:ValidateToken] Error:', error)
    return NextResponse.json(
      { valid: false, error: error.message || 'Validation failed' },
      { status: 500 },
    )
  }
}
