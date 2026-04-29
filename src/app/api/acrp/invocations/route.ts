import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/acrp/invocations — List invocation history
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const agentId = searchParams.get('agentId')
    const capabilityId = searchParams.get('capabilityId')
    const status = searchParams.get('status')
    const limitParam = searchParams.get('limit')
    const userId = searchParams.get('userId')

    const limit = Math.min(parseInt(limitParam || '50', 10), 200)

    // Build where clause
    const where: Record<string, unknown> = {}

    if (agentId) {
      where.agentId = agentId
    } else if (userId) {
      // If no specific agentId, filter by agents belonging to the user
      where.agent = { userId }
    }

    if (capabilityId) {
      where.capabilityId = capabilityId
    }

    if (status) {
      where.status = status
    }

    const invocations = await db.capabilityInvocation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        capability: {
          select: {
            name: true,
            category: true,
            uiHints: true,
          },
        },
      },
    })

    return NextResponse.json({ invocations })
  } catch (error) {
    console.error('[ACRP] invocations list error:', error)
    return NextResponse.json(
      { error: 'Failed to list invocations' },
      { status: 500 }
    )
  }
}
