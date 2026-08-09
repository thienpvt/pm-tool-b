import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { companyNameAndQuota, setCompanyHeadcountQuota } from '@/lib/repositories/portfolio.repo';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const company = await companyNameAndQuota(user.company_id);
  return NextResponse.json({ headcount_quota: company?.headcount_quota ?? 0 });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const quota = Math.max(0, Number(body.headcount_quota) || 0);
  await setCompanyHeadcountQuota(user.company_id, quota);
  return NextResponse.json({ headcount_quota: quota });
}
