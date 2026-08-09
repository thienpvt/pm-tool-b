import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  createPortfolioBudgetCategory,
  findPortfolioBudget,
  portfolioBudgetCategories,
} from '@/lib/repositories/portfolio.repo';

type Params = { params: Promise<{ id: string }> };

async function verifyOwnership(budgetId: string, companyId: number | null) {
  return findPortfolioBudget(companyId, budgetId);
}

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!await verifyOwnership(id, user.company_id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const cats = await portfolioBudgetCategories(id);
  return NextResponse.json(cats);
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!await verifyOwnership(id, user.company_id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const { category, ceiling_amount, notes } = body;
  if (!category) return NextResponse.json({ error: 'category required' }, { status: 400 });

  const created = await createPortfolioBudgetCategory(id, { category, ceiling_amount, notes });
  return NextResponse.json(created, { status: 201 });
}
