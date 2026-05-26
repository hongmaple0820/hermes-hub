import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateEndpointToken, generateCallbackSecret } from '@/lib/skill-protocol'

/**
 * POST /api/agents/[id]/generate-skill-endpoint
 * Generate an endpoint URL for a specific agent's skill or plugin binding
 * 
 * Body: { skillId?: string, pluginId?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify agent belongs to user
    const agent = await db.agent.findFirst({
      where: { id: agentId, userId },
    })
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const body = await request.json()
    const { skillId, pluginId } = body

    const token = generateEndpointToken()
    const secret = generateCallbackSecret()

    if (skillId) {
      const agentSkill = await db.agentSkill.findUnique({
        where: { agentId_skillId: { agentId, skillId } },
        include: { skill: true },
      })
      if (!agentSkill) {
        return NextResponse.json({ error: 'Skill not installed on this agent' }, { status: 404 })
      }

      // If already has a token, regenerate
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
        connectionMode: 'websocket',
        wsConnectUrl: '/?XTransformPort=3004',
        wsDirectUrl: 'ws://localhost:3004/',
        skillName: agentSkill.skill.name,
        skillDisplayName: agentSkill.skill.displayName,
      })
    }

    if (pluginId) {
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
        connectionMode: 'websocket',
        wsConnectUrl: '/?XTransformPort=3004',
        wsDirectUrl: 'ws://localhost:3004/',
        pluginName: plugin.name,
      })
    }

    return NextResponse.json({ error: 'Must specify skillId or pluginId' }, { status: 400 })
  } catch (error: any) {
    console.error('[Agent:GenerateSkillEndpoint] Error:', error)
    return NextResponse.json({ error: error.message || 'Endpoint generation failed' }, { status: 500 })
  }
}
