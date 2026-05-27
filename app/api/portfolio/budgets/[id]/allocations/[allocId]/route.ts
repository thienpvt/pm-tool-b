import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string; allocId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, allocId } = await params;
  const db = await getDb();

  const budget = await db.get('SELECT id FROM portfolio_budgets WHERE id = ? AND company_id = ?', id, user.company_id);
  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { project_id, allocated_amount, notes } = body;

  await db.run(
    'UPDATE portfolio_budget_allocations SET project_id=?, allocated_amount=?, notes=? WHERE id=? AND portfolio_budget_id=?',
    project_id || null, allocated_amount, notes, allocId, id
  );
  const updated = await db.get(
    `SELECT pba.*, p.name AS project_name FROM portfolio_budget_allocations pba
     LEFT JOIN projects p ON p.id = pba.project_id WHERE pba.id = ?`,
    allocId
  );
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, allocId } = await params;
  const db = await getDb();

  const budget = await db.get('SELECT id FROM portfolio_budgets WHERE id = ? AND company_id = ?', id, user.company_id);
  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.run('DELETE FROM portfolio_budget_allocations WHERE id = ? AND portfolio_budget_id = ?', allocId, id);
  return NextResponse.json({ ok: true });
}
