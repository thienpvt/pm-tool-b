import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  deletePortfolioBudget,
  findPortfolioBudget,
  portfolioBudgetAllocations,
  portfolioBudgetCategories,
  spendByCategory,
  updatePortfolioBudget,
} from '@/lib/repositories/portfolio.repo';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const budget = await findPortfolioBudget(user.company_id, id);
  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [categories, allocations] = await Promise.all([
    portfolioBudgetCategories(id), portfolioBudgetAllocations(id),
  ]);

  // Warning: total allocated vs total_amount
  const totalAllocated = (allocations as Array<{ allocated_amount: number }>)
    .reduce((s, a) => s + Number(a.allocated_amount), 0);

  // Warning per category: sum of budget_items.planned_amount for allocated projects
  const categoryWarnings: Record<string, { ceiling: number; used: number }> = {};
  for (const cat of categories as Array<{ category: string; ceiling_amount: number }>) {
    const row = await spendByCategory(id, cat.category);
    categoryWarnings[cat.category] = {
      ceiling: Number(cat.ceiling_amount),
      used: Number(row?.used ?? 0),
    };
  }

  return NextResponse.json({
    budget,
    categories,
    allocations,
    summary: {
      total_allocated: totalAllocated,
      over_total: totalAllocated > Number((budget as { total_amount: number }).total_amount),
      category_warnings: categoryWarnings,
    },
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await findPortfolioBudget(user.company_id, id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { period_type, period_label, start_date, end_date, total_amount, currency, status, notes } = body;

  const updated = await updatePortfolioBudget(id, {
    period_type, period_label, start_date, end_date, total_amount, currency, status, notes,
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await deletePortfolioBudget(user.company_id, id);
  return NextResponse.json({ ok: true });
}
