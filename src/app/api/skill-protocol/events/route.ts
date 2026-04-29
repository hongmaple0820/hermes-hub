import { NextRequest, NextResponse } from 'next/server'
import { processInboundEvent } from '@/lib/skill-protocol'

/**
 * POST /api/skill-protocol/events
 * Receive events FROM an external agent (inbound events)
 * 
 * Body: {
 *   endpointToken: string,
 *   event: { type: string, data: any, timestamp: string }
 * }
 * 
 * Event types:
 * - message: External agent sends a message (response or proactive)
 * - command: External agent sends a command
 * - status: External agent status update
 * - tool_result: External agent returns a tool execution result
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { endpointToken, event } = body

    if (!endpointToken || !event || !event.type) {
      return NextResponse.json(
        { error: 'Missing required fields: endpointToken, event.type' },
        { status: 400 }
      )
    }

    // Validate event type
    const validTypes = ['message', 'command', 'status', 'tool_result', 'heartbeat', 'tool_call']
    if (!validTypes.includes(event.type)) {
      return NextResponse.json(
        { error: `Invalid event type: ${event.type}. Valid types: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Ensure timestamp
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString()
    }

    const result = await processInboundEvent(endpointToken, {
      ...event,
      source: 'external',
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      eventId: result.eventId,
      processedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[SkillProtocol:Events] Error:', error)
    return NextResponse.json({ error: error.message || 'Event processing failed' }, { status: 500 })
  }
}
