import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { deletePortfolioMember, updatePortfolioMember } from '@/lib/repositories/portfolio.repo';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { role = '', name, email = '', note = '', member_type = 'internal', member_category = 'delivery', overhead_remaining = 0 } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  const row = await updatePortfolioMember(user.company_id, id, {
    role, name: name.trim(), email, note, member_type, member_category, overhead_remaining,
  });
  return NextResponse.json(row);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await deletePortfolioMember(user.company_id, id);
  return NextResponse.json({ ok: true });
}
