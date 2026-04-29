import { NextRequest, NextResponse } from 'next/server'
import { registerExternalAgent } from '@/lib/skill-protocol'

/**
 * POST /api/skill-protocol/register
 * Register an external agent to a skill via endpoint token
 * 
 * Body: {
 *   endpointToken: string,
 *   agentInfo: { name, version?, capabilities?, callbackUrl, metadata? }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { endpointToken, agentInfo } = body

    if (!endpointToken || !agentInfo || !agentInfo.name || !agentInfo.callbackUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: endpointToken, agentInfo.name, agentInfo.callbackUrl' },
        { status: 400 }
      )
    }

    const result = await registerExternalAgent({ endpointToken, agentInfo })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Return registration details
    return NextResponse.json({
      success: true,
      protocol: 'v1',
      events: ['message', 'command', 'status', 'tool_result', 'heartbeat', 'tool_call'],
      heartbeatInterval: 30,
      message: `Successfully registered agent "${agentInfo.name}"`,
    })
  } catch (error: any) {
    console.error('[SkillProtocol:Register] Error:', error)
    return NextResponse.json({ error: error.message || 'Registration failed' }, { status: 500 })
  }
}
