import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const company = await db.get<{ headcount_quota: number }>(
    'SELECT headcount_quota FROM companies WHERE id = ?', user.company_id
  );
  return NextResponse.json({ headcount_quota: company?.headcount_quota ?? 0 });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const quota = Math.max(0, Number(body.headcount_quota) || 0);
  const db = await getDb();
  await db.run('UPDATE companies SET headcount_quota = ? WHERE id = ?', quota, user.company_id);
  return NextResponse.json({ headcount_quota: quota });
}
