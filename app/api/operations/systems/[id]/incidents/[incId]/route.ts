import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string; incId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, incId } = await params;
  const db = await getDb();

  const sys = await db.get('SELECT id FROM operations_systems WHERE id = ? AND company_id = ?', id, user.company_id);
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { title, severity, description, reported_at, resolved_at, cost_impact, status } = body;

  await db.run(
    `UPDATE operations_incidents
     SET title=?, severity=?, description=?, reported_at=?, resolved_at=?, cost_impact=?, status=?
     WHERE id=? AND operations_system_id=?`,
    title, severity, description, reported_at, resolved_at || null, cost_impact, status, incId, id
  );
  const updated = await db.get('SELECT * FROM operations_incidents WHERE id = ?', incId);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, incId } = await params;
  const db = await getDb();

  const sys = await db.get('SELECT id FROM operations_systems WHERE id = ? AND company_id = ?', id, user.company_id);
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.run('DELETE FROM operations_incidents WHERE id = ? AND operations_system_id = ?', incId, id);
  return NextResponse.json({ ok: true });
}
