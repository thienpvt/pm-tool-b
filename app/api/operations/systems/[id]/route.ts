import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();

  const system = await db.get(
    `SELECT os.*, p.name AS project_name FROM operations_systems os
     LEFT JOIN projects p ON p.id = os.project_id
     WHERE os.id = ? AND os.company_id = ?`,
    id, user.company_id
  );
  if (!system) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const budgetItems = await db.all(
    'SELECT * FROM operations_budget_items WHERE operations_system_id = ? ORDER BY category, name',
    id
  );
  const expenses = await db.all(
    'SELECT * FROM operations_expenses WHERE operations_system_id = ? ORDER BY expense_date DESC',
    id
  );
  const incidents = await db.all(
    'SELECT * FROM operations_incidents WHERE operations_system_id = ? ORDER BY reported_at DESC',
    id
  );

  return NextResponse.json({ system, budgetItems, expenses, incidents });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();

  const existing = await db.get('SELECT id FROM operations_systems WHERE id = ? AND company_id = ?', id, user.company_id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { name, description, project_id, go_live_date, status } = body;

  await db.run(
    'UPDATE operations_systems SET name=?, description=?, project_id=?, go_live_date=?, status=? WHERE id=?',
    name, description, project_id || null, go_live_date || null, status, id
  );
  const updated = await db.get(
    `SELECT os.*, p.name AS project_name FROM operations_systems os
     LEFT JOIN projects p ON p.id = os.project_id WHERE os.id = ?`,
    id
  );
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();
  await db.run('DELETE FROM operations_systems WHERE id = ? AND company_id = ?', id, user.company_id);
  return NextResponse.json({ ok: true });
}
