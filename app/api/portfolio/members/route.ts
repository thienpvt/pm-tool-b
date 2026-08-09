import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  createPortfolioMember,
  portfolioMembersWithUtilization,
} from '@/lib/repositories/portfolio.repo';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await portfolioMembersWithUtilization(user.company_id));
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { role = '', name, email = '', note = '', member_type = 'internal', member_category = 'delivery', overhead_remaining = 0 } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  const row = await createPortfolioMember(user.company_id, {
    role, name: name.trim(), email, note, member_type, member_category, overhead_remaining,
  });
  return NextResponse.json(row, { status: 201 });
}
