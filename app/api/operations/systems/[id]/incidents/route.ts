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

  const incidents = await db.all(
    'SELECT * FROM operations_incidents WHERE operations_system_id = ? ORDER BY reported_at DESC',
    id
  );
  return NextResponse.json(incidents);
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();

  const sys = await db.get('SELECT id FROM operations_systems WHERE id = ? AND company_id = ?', id, user.company_id);
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { title, severity, description, reported_at, resolved_at, cost_impact, status } = body;
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

  const result = await db.run(
    `INSERT INTO operations_incidents
     (operations_system_id, title, severity, description, reported_at, resolved_at, cost_impact, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    title,
    severity || 'Medium',
    description || '',
    reported_at || new Date().toISOString().split('T')[0],
    resolved_at || null,
    cost_impact || 0,
    status || 'Open'
  );
  const created = await db.get('SELECT * FROM operations_incidents WHERE id = ?', result.lastInsertRowid);
  return NextResponse.json(created, { status: 201 });
}
