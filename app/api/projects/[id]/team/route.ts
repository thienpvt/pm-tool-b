import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await getDb();
  return NextResponse.json(await db.all('SELECT * FROM team_members WHERE project_id = ? ORDER BY domain, id', id));
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = await getDb();
  const r = await db.run('INSERT INTO team_members (project_id, domain, role, name, capacity_json, notes) VALUES (?,?,?,?,?,?)', id, body.domain ?? '', body.role ?? '', body.name ?? '', body.capacity_json ?? '{}', body.notes ?? '');
  return NextResponse.json(await db.get('SELECT * FROM team_members WHERE id = ?', r.lastInsertRowid), { status: 201 });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = await getDb();
  const { id: rowId, ...fields } = body;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  await db.run(`UPDATE team_members SET ${sets} WHERE id = ? AND project_id = ?`, ...Object.values(fields), rowId, id);
  return NextResponse.json(await db.get('SELECT * FROM team_members WHERE id = ?', rowId));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const db = await getDb();
  await db.run('DELETE FROM team_members WHERE id = ? AND project_id = ?', searchParams.get('rowId'), id);
  return NextResponse.json({ ok: true });
}
