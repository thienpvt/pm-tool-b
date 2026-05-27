import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();

  const sys = await db.get('SELECT id FROM operations_systems WHERE id = ? AND company_id = ?', id, user.company_id);
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const expenses = await db.all(
    'SELECT * FROM operations_expenses WHERE operations_system_id = ? ORDER BY expense_date DESC',
    id
  );
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();

  const sys = await db.get('SELECT id FROM operations_systems WHERE id = ? AND company_id = ?', id, user.company_id);
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { expense_date, category, description, amount, reference } = body;

  const result = await db.run(
    `INSERT INTO operations_expenses
     (operations_system_id, expense_date, category, description, amount, reference)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    expense_date || new Date().toISOString().split('T')[0],
    category || 'OPEX',
    description || '',
    amount || 0,
    reference || ''
  );
  const created = await db.get('SELECT * FROM operations_expenses WHERE id = ?', result.lastInsertRowid);
  return NextResponse.json(created, { status: 201 });
}
