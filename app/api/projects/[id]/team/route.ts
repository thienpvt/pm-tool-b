import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  return NextResponse.json(getDb().prepare('SELECT * FROM team_members WHERE project_id = ? ORDER BY domain, id').all(id));
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const r = db.prepare('INSERT INTO team_members (project_id, domain, role, name, capacity_json, notes) VALUES (?,?,?,?,?,?)').run(id, body.domain ?? '', body.role ?? '', body.name ?? '', body.capacity_json ?? '{}', body.notes ?? '');
  return NextResponse.json(db.prepare('SELECT * FROM team_members WHERE id = ?').get(r.lastInsertRowid), { status: 201 });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const { id: rowId, ...fields } = body;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE team_members SET ${sets} WHERE id = ? AND project_id = ?`).run(...Object.values(fields), rowId, id);
  return NextResponse.json(db.prepare('SELECT * FROM team_members WHERE id = ?').get(rowId));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  getDb().prepare('DELETE FROM team_members WHERE id = ? AND project_id = ?').run(searchParams.get('rowId'), id);
  return NextResponse.json({ ok: true });
}
