import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { bugCountsByAssignee } from '@/modules/portfolio/backend/repositories/portfolio.repo';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await bugCountsByAssignee(user.company_id);

  return NextResponse.json(rows ?? []);
}
