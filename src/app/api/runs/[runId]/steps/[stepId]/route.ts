import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Internal API - update a step
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string; stepId: string }> }
) {
  try {
    const { stepId } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['status', 'detail', 'completedAt'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'detail') {
          updateData[field] = JSON.stringify(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // If status is completed or failed, set completedAt if not provided
    if ((body.status === 'completed' || body.status === 'failed') && !body.completedAt) {
      updateData.completedAt = new Date();
    }

    const step = await db.step.update({
      where: { id: stepId },
      data: updateData,
    });

    return NextResponse.json({ step });
  } catch (error) {
    console.error('Update step error:', error);
    return NextResponse.json({ error: 'Failed to update step' }, { status: 500 });
  }
}
