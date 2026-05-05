import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await getDb();
  return NextResponse.json(await db.all('SELECT * FROM risks WHERE project_id = ? ORDER BY id', id));
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = await getDb();
  const countRow = await db.get('SELECT COUNT(*) as c FROM risks WHERE project_id = ?', id) as { c: number };
  const riskId = body.risk_id || `R${Number(countRow.c) + 1}`;
  const r = await db.run('INSERT INTO risks (project_id, risk_id, description, category, owner, trigger, mitigation, due_date, status, priority, impact, affected_activity_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', id, riskId, body.description ?? '', body.category ?? '', body.owner ?? '', body.trigger ?? '', body.mitigation ?? '', body.due_date ?? '', body.status ?? 'Open', body.priority ?? 'Medium', body.impact ?? 'Major', body.affected_activity_id ?? null);
  return NextResponse.json(await db.get('SELECT * FROM risks WHERE id = ?', r.lastInsertRowid), { status: 201 });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = await getDb();
  const { id: rowId, ...fields } = body;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  await db.run(`UPDATE risks SET ${sets} WHERE id = ? AND project_id = ?`, ...Object.values(fields), rowId, id);
  return NextResponse.json(await db.get('SELECT * FROM risks WHERE id = ?', rowId));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const db = await getDb();
  await db.run('DELETE FROM risks WHERE id = ? AND project_id = ?', searchParams.get('rowId'), id);
  return NextResponse.json({ ok: true });
}
