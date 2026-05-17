import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();

  const project = await db.get<{ id: number; company_id: number }>(
    'SELECT id, company_id FROM projects WHERE id = ?', id
  );
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!user.is_admin && project.company_id !== user.company_id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const items = await db.all(
    'SELECT * FROM budget_items WHERE project_id = ? ORDER BY type, group_name, created_at',
    id
  );

  // Project completion for EVM metrics
  const stats = await db.get<{ avg_pct: number; total: number }>(
    'SELECT AVG(completion_pct) as avg_pct, COUNT(*) as total FROM activities WHERE project_id = ?',
    id
  );
  const completion_pct = Math.round(stats?.avg_pct ?? 0);

  return NextResponse.json({ items, completion_pct });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();

  const project = await db.get<{ id: number; company_id: number }>(
    'SELECT id, company_id FROM projects WHERE id = ?', id
  );
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!user.is_admin && project.company_id !== user.company_id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { type, group_name, name, planned_amount, actual_amount, unit, notes } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!['CAPEX', 'OPEX'].includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  const result = await db.run(
    `INSERT INTO budget_items (project_id, type, group_name, name, planned_amount, actual_amount, unit, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    type,
    group_name?.trim() ?? '',
    name.trim(),
    Number(planned_amount) || 0,
    Number(actual_amount) || 0,
    unit?.trim() || 'USD',
    notes?.trim() ?? ''
  );

  const item = await db.get('SELECT * FROM budget_items WHERE id = ?', result.lastInsertRowid);
  return NextResponse.json(item, { status: 201 });
}
