import { NextRequest, NextResponse } from 'next/server'
import { findBindingByToken } from '@/lib/skill-protocol'

/**
 * GET /api/skill-protocol/validate
 * Validate an endpoint token and return binding info.
 * Used by the skill-ws WebSocket server to authenticate incoming connections.
 *
 * Query: ?token={endpointToken}
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

    const binding = await findBindingByToken(token)

    if (!binding) {
      return NextResponse.json(
        { valid: false, error: 'Invalid endpoint token' },
        { status: 401 },
      )
    }

    // Return binding info for the WS server to store on socket.data
    const result: Record<string, any> = {
      valid: true,
      bindingType: binding.type,
      agentId: binding.agentId,
    }

    if (binding.type === 'agent_skill') {
      result.skillId = binding.record.skillId
      result.skillName = binding.record.skill?.name
      result.isEnabled = binding.record.isEnabled
    } else if (binding.type === 'agent_plugin') {
      result.pluginId = binding.record.id
      result.pluginName = binding.record.name
      result.isEnabled = binding.record.isEnabled
    } else if (binding.type === 'agent_connection') {
      result.connectionId = binding.record.id
      result.connectionType = binding.record.type
      result.status = binding.record.status
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[SkillProtocol:Validate] Error:', error)
    return NextResponse.json(
      { valid: false, error: error.message || 'Validation failed' },
      { status: 500 },
    )
  }
}
