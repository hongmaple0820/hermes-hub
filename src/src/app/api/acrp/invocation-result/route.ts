import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/acrp/invocation-result
 * Record the result of a capability invocation.
 * Called by the skill-ws service when an agent sends capability:result.
 *
 * Body: {
 *   invocationId: string;
 *   agentId: string;
 *   capabilityId: string;
 *   result?: any;
 *   error?: string;
 *   duration?: number;  // ms
 *   invokedBy?: string;
 *   params?: object;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invocationId, agentId, capabilityId, result, error, duration, invokedBy, params } = body

    if (!invocationId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: invocationId' },
        { status: 400 },
      )
    }

    // Find the existing invocation
    const invocation = await db.capabilityInvocation.findUnique({
      where: { id: invocationId },
    })

    if (!invocation) {
      // Create a new invocation record if it doesn't exist (e.g., fire-and-forget from skill-ws)
      try {
        await db.capabilityInvocation.create({
          data: {
            id: invocationId,
            agentId: agentId || 'unknown',
            capabilityId: capabilityId || 'unknown',
            invokedBy: invokedBy || 'system',
            params: JSON.stringify(params || {}),
            result: result !== undefined ? JSON.stringify(result) : null,
            status: error ? 'failed' : 'success',
            error: error || null,
            duration: duration || null,
            completedAt: new Date(),
          },
        })
      } catch (createErr: any) {
        // If creation fails (e.g., missing FK), just log it
        console.error('[ACRP:InvocationResult] Failed to create invocation record:', createErr.message)
      }
    } else {
      // Update existing invocation
      await db.capabilityInvocation.update({
        where: { id: invocationId },
        data: {
          result: result !== undefined ? JSON.stringify(result) : invocation.result,
          status: error ? 'failed' : 'success',
          error: error || null,
          duration: duration !== undefined ? duration : invocation.duration,
          completedAt: new Date(),
        },
      })

      // Update the capability's invocation stats
      try {
        await db.agentCapability.update({
          where: {
            agentId_capabilityId: {
              agentId: invocation.agentId,
              capabilityId: invocation.capabilityId,
            },
          },
          data: {
            invokeCount: { increment: 1 },
            lastInvokedAt: new Date(),
          },
        })
      } catch {
        // Capability might not exist, that's ok
      }
    }

    return NextResponse.json({
      success: true,
      invocationId,
    })
  } catch (error: any) {
    console.error('[ACRP:InvocationResult] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to record invocation result' },
      { status: 500 },
    )
  }
}
