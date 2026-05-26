import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/skill-protocol/ws-status
 * Update the WebSocket connection status for an agent binding.
 * Called by the skill-ws service when agents connect/disconnect/update.
 *
 * Body: {
 *   endpointToken: string,
 *   status: 'connected' | 'disconnected',
 *   agentInfo?: { name, version, capabilities, platform, metadata }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { endpointToken, status, agentInfo } = body

    if (!endpointToken || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: endpointToken, status' },
        { status: 400 },
      )
    }

    // Find the binding by token
    const agentSkill = await db.agentSkill.findUnique({ where: { endpointToken } })
    if (agentSkill) {
      const updateData: Record<string, any> = {}

      if (status === 'connected') {
        updateData.isEnabled = true
        if (agentInfo) {
          updateData.callbackSecret = agentInfo.capabilities
            ? JSON.stringify({
                name: agentInfo.name,
                version: agentInfo.version,
                capabilities: agentInfo.capabilities,
                platform: agentInfo.platform,
                metadata: agentInfo.metadata,
                connectedAt: new Date().toISOString(),
              })
            : undefined
        }
      }

      // Update the skill's heartbeat and registration info
      await db.skill.update({
        where: { id: agentSkill.skillId },
        data: {
          lastHeartbeat: status === 'connected' ? new Date() : undefined,
          registrationInfo:
            agentInfo && status === 'connected'
              ? JSON.stringify({
                  name: agentInfo.name,
                  version: agentInfo.version,
                  capabilities: agentInfo.capabilities,
                  platform: agentInfo.platform,
                  metadata: agentInfo.metadata,
                  wsConnected: status === 'connected',
                  lastStatusUpdate: new Date().toISOString(),
                })
              : undefined,
          registeredAt: status === 'connected' ? new Date() : undefined,
        },
      })

      return NextResponse.json({ success: true, bindingType: 'agent_skill' })
    }

    const agentPlugin = await db.agentPlugin.findUnique({ where: { endpointToken } })
    if (agentPlugin) {
      const updateData: Record<string, any> = {}

      if (status === 'connected') {
        updateData.isEnabled = true
        updateData.registeredAt = new Date()
        updateData.lastHeartbeat = new Date()
        if (agentInfo) {
          updateData.registrationInfo = JSON.stringify({
            name: agentInfo.name,
            version: agentInfo.version,
            capabilities: agentInfo.capabilities,
            platform: agentInfo.platform,
            metadata: agentInfo.metadata,
            wsConnected: true,
            lastStatusUpdate: new Date().toISOString(),
          })
        }
      } else {
        updateData.registrationInfo = JSON.stringify({
          ...JSON.parse(agentPlugin.registrationInfo || '{}'),
          wsConnected: false,
          lastStatusUpdate: new Date().toISOString(),
        })
      }

      await db.agentPlugin.update({
        where: { id: agentPlugin.id },
        data: updateData,
      })

      return NextResponse.json({ success: true, bindingType: 'agent_plugin' })
    }

    const agentConnection = await db.agentConnection.findUnique({ where: { endpointToken } })
    if (agentConnection) {
      await db.agentConnection.update({
        where: { id: agentConnection.id },
        data: {
          status,
          lastPing: status === 'connected' ? new Date() : undefined,
          registrationInfo:
            agentInfo && status === 'connected'
              ? JSON.stringify({
                  name: agentInfo.name,
                  version: agentInfo.version,
                  capabilities: agentInfo.capabilities,
                  platform: agentInfo.platform,
                  metadata: agentInfo.metadata,
                  wsConnected: status === 'connected',
                  lastStatusUpdate: new Date().toISOString(),
                })
              : undefined,
        },
      })

      // Also update agent status
      if (status === 'connected') {
        await db.agent.update({
          where: { id: agentConnection.agentId },
          data: { status: 'online' },
        })
      } else {
        // Check if all connections are disconnected before marking agent offline
        const activeConnections = await db.agentConnection.count({
          where: {
            agentId: agentConnection.agentId,
            status: 'connected',
            id: { not: agentConnection.id },
          },
        })
        if (activeConnections === 0) {
          await db.agent.update({
            where: { id: agentConnection.agentId },
            data: { status: 'offline' },
          })
        }
      }

      return NextResponse.json({ success: true, bindingType: 'agent_connection' })
    }

    return NextResponse.json(
      { error: 'Invalid endpoint token' },
      { status: 401 },
    )
  } catch (error: any) {
    console.error('[SkillProtocol:WsStatus] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Status update failed' },
      { status: 500 },
    )
  }
}
