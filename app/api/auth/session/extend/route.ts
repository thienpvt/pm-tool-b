import { NextRequest, NextResponse } from 'next/server';
import { extendSession, SESSION_COOKIE_NAME, unauthorized } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return unauthorized();
  const extended = await extendSession(sessionId);
  if (!extended) return unauthorized();
  return NextResponse.json({ ok: true });
}
