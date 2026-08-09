import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  deletePortfolioBudgetCategory,
  findPortfolioBudget,
  updatePortfolioBudgetCategory,
} from '@/lib/repositories/portfolio.repo';

type Params = { params: Promise<{ id: string; catId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, catId } = await params;
  const budget = await findPortfolioBudget(user.company_id, id);
  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { category, ceiling_amount, notes } = body;

  const updated = await updatePortfolioBudgetCategory(id, catId, { category, ceiling_amount, notes });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, catId } = await params;
  const budget = await findPortfolioBudget(user.company_id, id);
  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await deletePortfolioBudgetCategory(id, catId);
  return NextResponse.json({ ok: true });
}
