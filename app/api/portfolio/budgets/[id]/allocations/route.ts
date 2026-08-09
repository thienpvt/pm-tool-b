import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  createPortfolioBudgetAllocation,
  findPortfolioBudget,
  portfolioBudgetAllocations,
} from '@/lib/repositories/portfolio.repo';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const budget = await findPortfolioBudget(user.company_id, id);
  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allocs = await portfolioBudgetAllocations(id);
  return NextResponse.json(allocs);
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const budget = await findPortfolioBudget(user.company_id, id);
  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { project_id, allocated_amount, notes } = body;

  const created = await createPortfolioBudgetAllocation(id, { project_id, allocated_amount, notes });
  return NextResponse.json(created, { status: 201 });
}
