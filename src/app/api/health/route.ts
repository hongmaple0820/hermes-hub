import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'hermes-nextjs',
    port: 3000,
    uptime: process.uptime(),
  });
}
