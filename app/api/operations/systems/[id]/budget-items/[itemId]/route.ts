import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, itemId } = await params;
  const db = await getDb();

  const sys = await db.get('SELECT id FROM operations_systems WHERE id = ? AND company_id = ?', id, user.company_id);
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { category, name, planned_amount, actual_amount, unit, period_label, notes } = body;

  await db.run(
    `UPDATE operations_budget_items
     SET category=?, name=?, planned_amount=?, actual_amount=?, unit=?, period_label=?, notes=?
     WHERE id=? AND operations_system_id=?`,
    category, name, planned_amount, actual_amount, unit, period_label, notes, itemId, id
  );
  const updated = await db.get('SELECT * FROM operations_budget_items WHERE id = ?', itemId);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, itemId } = await params;
  const db = await getDb();

  const sys = await db.get('SELECT id FROM operations_systems WHERE id = ? AND company_id = ?', id, user.company_id);
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.run('DELETE FROM operations_budget_items WHERE id = ? AND operations_system_id = ?', itemId, id);
  return NextResponse.json({ ok: true });
}
