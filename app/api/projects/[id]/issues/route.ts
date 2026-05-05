import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  return NextResponse.json(getDb().prepare('SELECT * FROM issues WHERE project_id = ? ORDER BY id').all(id));
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM issues WHERE project_id = ?').get(id) as { c: number }).c;
  const issueId = body.issue_id || `I${count + 1}`;
  const r = db.prepare('INSERT INTO issues (project_id, issue_id, description, root_cause, category, owner, trigger, mitigation, due_date, status, priority, impact, affected_activity_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, issueId, body.description ?? '', body.root_cause ?? '', body.category ?? '', body.owner ?? '', body.trigger ?? '', body.mitigation ?? '', body.due_date ?? '', body.status ?? 'Open', body.priority ?? 'Medium', body.impact ?? 'Major', body.affected_activity_id ?? null);
  return NextResponse.json(db.prepare('SELECT * FROM issues WHERE id = ?').get(r.lastInsertRowid), { status: 201 });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const { id: rowId, ...fields } = body;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE issues SET ${sets} WHERE id = ? AND project_id = ?`).run(...Object.values(fields), rowId, id);
  return NextResponse.json(db.prepare('SELECT * FROM issues WHERE id = ?').get(rowId));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  getDb().prepare('DELETE FROM issues WHERE id = ? AND project_id = ?').run(searchParams.get('rowId'), id);
  return NextResponse.json({ ok: true });
}
