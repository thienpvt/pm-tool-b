import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const rows = db.prepare('SELECT * FROM activities WHERE project_id = ? ORDER BY order_idx, id').all(id);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const maxOrder = (db.prepare('SELECT MAX(order_idx) as m FROM activities WHERE project_id = ?').get(id) as { m: number }).m ?? 0;
  const r = db.prepare(`
    INSERT INTO activities (project_id, phase, no, activity, deliverable, sign_off_doc, accountable, responsible, support, plan_start, plan_end, actual_start, actual_end, status, completion_pct, notes, order_idx)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, body.phase ?? 'General', body.no ?? '', body.activity ?? '', body.deliverable ?? '', body.sign_off_doc ?? '', body.accountable ?? '', body.responsible ?? '', body.support ?? '', body.plan_start ?? '', body.plan_end ?? '', body.actual_start ?? '', body.actual_end ?? '', body.status ?? 'To-do', body.completion_pct ?? 0, body.notes ?? '', maxOrder + 1);
  return NextResponse.json(db.prepare('SELECT * FROM activities WHERE id = ?').get(r.lastInsertRowid), { status: 201 });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json(); // expects { id, ...fields }
  const db = getDb();
  const { id: rowId, ...fields } = body;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE activities SET ${sets} WHERE id = ? AND project_id = ?`).run(...Object.values(fields), rowId, id);
  return NextResponse.json(db.prepare('SELECT * FROM activities WHERE id = ?').get(rowId));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const rowId = searchParams.get('rowId');
  const db = getDb();
  db.prepare('DELETE FROM activities WHERE id = ? AND project_id = ?').run(rowId, id);
  return NextResponse.json({ ok: true });
}
