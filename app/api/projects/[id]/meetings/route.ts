import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  return NextResponse.json(getDb().prepare('SELECT * FROM meetings WHERE project_id = ? ORDER BY id').all(id));
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const r = db.prepare('INSERT INTO meetings (project_id, name, frequency, content, participants, method, type) VALUES (?,?,?,?,?,?,?)').run(id, body.name ?? '', body.frequency ?? '', body.content ?? '', body.participants ?? '', body.method ?? '', body.type ?? 'regular');
  return NextResponse.json(db.prepare('SELECT * FROM meetings WHERE id = ?').get(r.lastInsertRowid), { status: 201 });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const { id: rowId, ...fields } = body;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE meetings SET ${sets} WHERE id = ? AND project_id = ?`).run(...Object.values(fields), rowId, id);
  return NextResponse.json(db.prepare('SELECT * FROM meetings WHERE id = ?').get(rowId));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  getDb().prepare('DELETE FROM meetings WHERE id = ? AND project_id = ?').run(searchParams.get('rowId'), id);
  return NextResponse.json({ ok: true });
}
