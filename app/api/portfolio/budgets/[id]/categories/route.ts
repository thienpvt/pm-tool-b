import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

async function verifyOwnership(budgetId: string, companyId: number | null) {
  const db = await getDb();
  return db.get('SELECT id FROM portfolio_budgets WHERE id = ? AND company_id = ?', budgetId, companyId);
}

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!await verifyOwnership(id, user.company_id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const db = await getDb();
  const cats = await db.all(
    'SELECT * FROM portfolio_budget_categories WHERE portfolio_budget_id = ? ORDER BY category',
    id
  );
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

  const db = await getDb();
  const result = await db.run(
    'INSERT INTO portfolio_budget_categories (portfolio_budget_id, category, ceiling_amount, notes) VALUES (?, ?, ?, ?)',
    id, category, ceiling_amount || 0, notes || ''
  );
  const created = await db.get('SELECT * FROM portfolio_budget_categories WHERE id = ?', result.lastInsertRowid);
  return NextResponse.json(created, { status: 201 });
}
