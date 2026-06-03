import { NextRequest, NextResponse } from 'next/server';
import { onCapabilityRegistered } from '@/lib/agent-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, capabilities } = body;

    if (!agentId || !capabilities || !Array.isArray(capabilities)) {
      return NextResponse.json({ error: 'agentId and capabilities[] are required' }, { status: 400 });
    }

    await onCapabilityRegistered(agentId, capabilities);

    return NextResponse.json({ success: true, converted: capabilities.length });
  } catch (error) {
    console.error('Capability registered notification error:', error);
    return NextResponse.json({ error: 'Failed to process notification' }, { status: 500 });
  }
}