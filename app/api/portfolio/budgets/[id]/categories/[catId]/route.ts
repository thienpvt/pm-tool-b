import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string; catId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, catId } = await params;
  const db = await getDb();

  const budget = await db.get('SELECT id FROM portfolio_budgets WHERE id = ? AND company_id = ?', id, user.company_id);
  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { category, ceiling_amount, notes } = body;

  await db.run(
    'UPDATE portfolio_budget_categories SET category=?, ceiling_amount=?, notes=? WHERE id=? AND portfolio_budget_id=?',
    category, ceiling_amount, notes, catId, id
  );
  const updated = await db.get('SELECT * FROM portfolio_budget_categories WHERE id = ?', catId);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, catId } = await params;
  const db = await getDb();

  const budget = await db.get('SELECT id FROM portfolio_budgets WHERE id = ? AND company_id = ?', id, user.company_id);
  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.run('DELETE FROM portfolio_budget_categories WHERE id = ? AND portfolio_budget_id = ?', catId, id);
  return NextResponse.json({ ok: true });
}
