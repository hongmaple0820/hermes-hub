import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/acrp/disconnect — Mark agent as disconnected
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentToken } = body

    if (!agentToken) {
      return NextResponse.json(
        { error: 'agentToken is required' },
        { status: 400 }
      )
    }

    const agent = await db.agent.findUnique({ where: { agentToken } })
    if (!agent) {
      return NextResponse.json({ error: 'Invalid agent token' }, { status: 401 })
    }

    await db.agent.update({
      where: { id: agent.id },
      data: {
        wsConnected: false,
        status: 'offline',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ACRP] disconnect error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect agent' },
      { status: 500 }
    )
  }
}
