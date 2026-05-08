import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json(null, { status: 401 });
  return NextResponse.json({
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    company_id: user.company_id,
    company_name: user.company_name,
    is_admin: user.is_admin,
    onboarding_completed: user.onboarding_completed,
  });
}
