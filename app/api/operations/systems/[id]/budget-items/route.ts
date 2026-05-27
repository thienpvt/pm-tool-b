import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

async function verifySystem(sysId: string, companyId: number | null) {
  const db = await getDb();
  return db.get('SELECT id FROM operations_systems WHERE id = ? AND company_id = ?', sysId, companyId);
}

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!await verifySystem(id, user.company_id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const db = await getDb();
  const items = await db.all(
    'SELECT * FROM operations_budget_items WHERE operations_system_id = ? ORDER BY category, name',
    id
  );
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!await verifySystem(id, user.company_id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { category, name, planned_amount, actual_amount, unit, period_label, notes } = body;
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const db = await getDb();
  const result = await db.run(
    `INSERT INTO operations_budget_items
     (operations_system_id, category, name, planned_amount, actual_amount, unit, period_label, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id, category || 'OPEX', name, planned_amount || 0, actual_amount || 0,
    unit || 'VND/month', period_label || '', notes || ''
  );
  const created = await db.get('SELECT * FROM operations_budget_items WHERE id = ?', result.lastInsertRowid);
  return NextResponse.json(created, { status: 201 });
}
