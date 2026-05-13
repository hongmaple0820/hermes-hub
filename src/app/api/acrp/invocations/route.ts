import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/acrp/invocations — List invocation history
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const searchParams = request.nextUrl.searchParams
    const agentId = searchParams.get('agentId')
    const capabilityId = searchParams.get('capabilityId')
    const status = searchParams.get('status')
    const limitParam = searchParams.get('limit')

    const limit = Math.min(parseInt(limitParam || '50', 10), 200)

    // Build where clause — always filter by user's agents
    const where: Record<string, unknown> = {
      agent: { userId: user.id },
    }

    if (agentId) {
      where.agentId = agentId
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ACRP] invocations list error:', error)
    return NextResponse.json(
      { error: 'Failed to list invocations' },
      { status: 500 }
    )
  }
}
