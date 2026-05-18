import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await getDb();
  const rows = await db.all('SELECT * FROM activities WHERE project_id = ? ORDER BY order_idx, id', id);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = await getDb();
  const maxOrderRow = await db.get('SELECT MAX(order_idx) as m FROM activities WHERE project_id = ?', id) as { m: number };
  const maxOrder = maxOrderRow.m ?? 0;
  const r = await db.run(`
    INSERT INTO activities (project_id, phase, no, activity, deliverable, sign_off_doc, accountable, responsible, support, plan_start, plan_end, actual_start, actual_end, status, completion_pct, notes, order_idx, delay_owner, delay_reason, jira_key, sprint)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `, id, body.phase ?? 'General', body.no ?? '', body.activity ?? '', body.deliverable ?? '', body.sign_off_doc ?? '', body.accountable ?? '', body.responsible ?? '', body.support ?? '', body.plan_start ?? '', body.plan_end ?? '', body.actual_start ?? '', body.actual_end ?? '', body.status ?? 'To-do', body.completion_pct ?? 0, body.notes ?? '', maxOrder + 1, body.delay_owner ?? 'N/A', body.delay_reason ?? '', body.jira_key ?? '', body.sprint ?? '');
  return NextResponse.json(await db.get('SELECT * FROM activities WHERE id = ?', r.lastInsertRowid), { status: 201 });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json(); // expects { id, ...fields }
  const db = await getDb();
  const { id: rowId, ...fields } = body;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  await db.run(`UPDATE activities SET ${sets} WHERE id = ? AND project_id = ?`, ...Object.values(fields), rowId, id);
  return NextResponse.json(await db.get('SELECT * FROM activities WHERE id = ?', rowId));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const rowId = searchParams.get('rowId');
  const db = await getDb();
  await db.run('DELETE FROM activities WHERE id = ? AND project_id = ?', rowId, id);
  return NextResponse.json({ ok: true });
}
