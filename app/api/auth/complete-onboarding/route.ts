import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { markOnboardingComplete } from '@/lib/repositories/auth.repo';

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await markOnboardingComplete(user.id);
  return NextResponse.json({ ok: true });
}
