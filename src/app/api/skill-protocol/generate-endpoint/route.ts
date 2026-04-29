import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateEndpointToken, generateCallbackSecret } from '@/lib/skill-protocol'

/**
 * POST /api/skill-protocol/generate-endpoint
 * Generate an endpoint URL for a skill+agent or plugin+agent binding
 * 
 * Body: { agentId: string, skillId?: string, pluginId?: string }
 * 
 * Returns: { endpointUrl, endpointToken, callbackSecret, protocol }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { agentId, skillId, pluginId } = body

    if (!agentId) {
      return NextResponse.json({ error: 'Missing agentId' }, { status: 400 })
    }

    // Verify agent belongs to user
    const agent = await db.agent.findFirst({
      where: { id: agentId, userId },
    })
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const token = generateEndpointToken()
    const secret = generateCallbackSecret()

    if (skillId) {
      // Generate endpoint for agent+skill binding
      const agentSkill = await db.agentSkill.findUnique({
        where: { agentId_skillId: { agentId, skillId } },
      })
      if (!agentSkill) {
        return NextResponse.json({ error: 'Skill not installed on this agent' }, { status: 404 })
      }

      await db.agentSkill.update({
        where: { id: agentSkill.id },
        data: {
          endpointToken: token,
          callbackSecret: secret,
        },
      })

      return NextResponse.json({
        endpointUrl: `/api/skill-protocol/events?token=${token}`,
        endpointToken: token,
        callbackSecret: secret,
        protocol: 'v1',
        bindingType: 'agent_skill',
        agentId,
        skillId,
      })
    }

    if (pluginId) {
      // Generate endpoint for plugin
      const plugin = await db.agentPlugin.findFirst({
        where: { id: pluginId, agentId },
      })
      if (!plugin) {
        return NextResponse.json({ error: 'Plugin not found' }, { status: 404 })
      }

      await db.agentPlugin.update({
        where: { id: plugin.id },
        data: {
          endpointToken: token,
          callbackSecret: secret,
        },
      })

      return NextResponse.json({
        endpointUrl: `/api/skill-protocol/events?token=${token}`,
        endpointToken: token,
        callbackSecret: secret,
        protocol: 'v1',
        bindingType: 'agent_plugin',
        agentId,
        pluginId,
      })
    }

    return NextResponse.json({ error: 'Must specify skillId or pluginId' }, { status: 400 })
  } catch (error: any) {
    console.error('[SkillProtocol:GenerateEndpoint] Error:', error)
    return NextResponse.json({ error: error.message || 'Endpoint generation failed' }, { status: 500 })
  }
}
