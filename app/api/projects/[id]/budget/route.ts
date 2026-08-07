import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { repoErrorResponse } from '@/lib/api-errors';
import {
  activityStats,
  createBudgetItem,
  listBudgetItems,
  listExpenses,
} from '@/lib/repositories/budget.repo';
import { projectAccessRow } from '@/lib/repositories/projects.repo';

type Ctx = { params: Promise<{ id: string }> };

async function checkBudgetAccess(req: NextRequest, projectId: string) {
  const user = await getSessionFromRequest(req);
  if (!user) return null;
  if (user.is_admin) return user;
  const project = await projectAccessRow(projectId);
  if (!project) return null;
  if (project.company_id !== user.company_id && project.customer_company_id !== user.company_id) return null;
  return user;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await checkBudgetAccess(req, id);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const [items, expenses, stats] = await Promise.all([
      listBudgetItems(id),
      listExpenses(id),
      activityStats(id),
    ]);

    const expByItem = new Map<number, unknown[]>();
    for (const e of expenses) {
      const bid = (e as { budget_item_id: number }).budget_item_id;
      if (!expByItem.has(bid)) expByItem.set(bid, []);
      expByItem.get(bid)!.push(e);
    }
    const itemsWithExpenses = items.map(i => ({
      ...i,
      expenses: expByItem.get((i as { id: number }).id) ?? [],
    }));

    return NextResponse.json({ items: itemsWithExpenses, completion_pct: Math.round(stats?.avg_pct ?? 0) });
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await checkBudgetAccess(req, id);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!['CAPEX', 'OPEX'].includes(body.type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    return NextResponse.json(await createBudgetItem(id, body), { status: 201 });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
