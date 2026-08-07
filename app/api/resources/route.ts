import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { listResourceMembers } from '@/lib/repositories/resources.repo';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json([], { status: 401 });

    return NextResponse.json(await listResourceMembers(user.company_id, Boolean(user.is_admin)));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
