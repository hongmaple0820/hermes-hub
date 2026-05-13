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
 * POST /api/acrp/register
 * Register an ACRP agent's capabilities.
 * Called by the skill-ws service when an agent sends agent:register.
 *
 * Supports two payload formats:
 *   1. { agentId, name, version, platform, capabilities, metadata } — from skill-ws
 *   2. { agentToken, agentInfo: { agentType, platform, version, metadata, capabilities } } — direct API
 *
 * Auth: Either x-internal-secret header (from skill-ws) OR requireAuth (from frontend)
 * Capabilities can use either `id` or `capabilityId` as the identifier field.
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

    // Normalize input from both formats
    let agentId: string | undefined
    let agentToken: string | undefined
    let name: string | undefined
    let version: string | undefined
    let platform: string | undefined
    let metadata: any
    let capabilities: any[]

    if (body.agentId) {
      // Format 1: skill-ws sends agentId-based payload
      agentId = body.agentId
      name = body.name
      version = body.version
      platform = body.platform
      metadata = body.metadata
      capabilities = body.capabilities || []
    } else if (body.agentToken) {
      // Format 2: direct API with agentToken
      agentToken = body.agentToken
      const agentInfo = body.agentInfo || {}
      name = agentInfo.name
      version = agentInfo.version
      platform = agentInfo.platform || agentInfo.agentType
      metadata = agentInfo.metadata
      capabilities = agentInfo.capabilities || []
    } else {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: agentId or agentToken' },
        { status: 400 },
      )
    }

    // Resolve agent
    let agent
    if (agentId) {
      agent = await db.agent.findUnique({ where: { id: agentId } })
    } else if (agentToken) {
      agent = await db.agent.findUnique({ where: { agentToken } })
    }

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

    const now = new Date()

    // Update the agent's ACRP info
    await db.agent.update({
      where: { id: agent.id },
      data: {
        agentType: platform || agent.agentType || 'custom',
        agentVersion: version || agent.agentVersion,
        agentPlatform: platform || agent.agentPlatform,
        agentMetadata: metadata ? JSON.stringify(metadata) : agent.agentMetadata,
        registeredAt: agent.registeredAt || now,
        lastHeartbeatAt: now,
        wsConnected: true,
        status: 'online',
      },
    })

    // Sync capabilities: upsert each capability
    const syncedCapabilityIds: string[] = []

    if (Array.isArray(capabilities)) {
      for (const cap of capabilities) {
        // Support both `id` (ACRP spec) and `capabilityId` (DB field)
        const capId = cap.id || cap.capabilityId
        if (!capId) continue

        try {
          await db.agentCapability.upsert({
            where: {
              agentId_capabilityId: {
                agentId: agent.id,
                capabilityId: capId,
              },
            },
            create: {
              agentId: agent.id,
              capabilityId: capId,
              name: cap.name || capId,
              description: cap.description || '',
              category: cap.category || 'general',
              version: cap.version || '1.0.0',
              parameters: typeof cap.parameters === 'string' ? cap.parameters : JSON.stringify(cap.parameters || {}),
              uiHints: typeof cap.uiHints === 'string' ? cap.uiHints : JSON.stringify(cap.uiHints || {}),
              isEnabled: cap.isEnabled !== false,
            },
            update: {
              name: cap.name || capId,
              description: cap.description || '',
              category: cap.category || 'general',
              version: cap.version || '1.0.0',
              parameters: typeof cap.parameters === 'string' ? cap.parameters : JSON.stringify(cap.parameters || {}),
              uiHints: typeof cap.uiHints === 'string' ? cap.uiHints : JSON.stringify(cap.uiHints || {}),
              isEnabled: cap.isEnabled !== false,
            },
          })
          syncedCapabilityIds.push(capId)
        } catch (capErr: any) {
          console.error(`[ACRP:Register] Failed to upsert capability ${capId}:`, capErr.message)
        }
      }

      // Remove capabilities that were not in the current registration (agent removed them)
      if (syncedCapabilityIds.length > 0) {
        await db.agentCapability.deleteMany({
          where: {
            agentId: agent.id,
            capabilityId: { notIn: syncedCapabilityIds },
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      agentId: agent.id,
      syncedCapabilities: syncedCapabilityIds,
      capabilitiesCount: syncedCapabilityIds.length,
    })
  } catch (error: any) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ACRP:Register] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Registration failed' },
      { status: 500 },
    )
  }
}
