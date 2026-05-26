import { NextRequest, NextResponse } from 'next/server'
import { processHeartbeat } from '@/lib/skill-protocol'

/**
 * POST /api/skill-protocol/heartbeat
 * Receive heartbeat from an external agent
 * 
 * Body: {
 *   endpointToken: string,
 *   status: string,
 *   metrics?: object
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { endpointToken, status, metrics } = body

    if (!endpointToken) {
      return NextResponse.json({ error: 'Missing endpointToken' }, { status: 400 })
    }

    const result = await processHeartbeat({ endpointToken, status, metrics })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      nextHeartbeat: result.nextHeartbeat,
      serverTime: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[SkillProtocol:Heartbeat] Error:', error)
    return NextResponse.json({ error: error.message || 'Heartbeat processing failed' }, { status: 500 })
  }
}
