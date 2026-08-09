import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  deletePortfolioBudgetAllocation,
  findPortfolioBudget,
  updatePortfolioBudgetAllocation,
} from '@/lib/repositories/portfolio.repo';

type Params = { params: Promise<{ id: string; allocId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, allocId } = await params;
  const budget = await findPortfolioBudget(user.company_id, id);
  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { project_id, allocated_amount, notes } = body;

  const updated = await updatePortfolioBudgetAllocation(id, allocId, {
    project_id, allocated_amount, notes,
  });
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, allocId } = await params;
  const budget = await findPortfolioBudget(user.company_id, id);
  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await deletePortfolioBudgetAllocation(id, allocId);
  return NextResponse.json({ ok: true });
}
