import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  return NextResponse.json(getDb().prepare('SELECT * FROM escalation_levels WHERE project_id = ? ORDER BY level DESC').all(id));
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const { id: rowId, ...fields } = body;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE escalation_levels SET ${sets} WHERE id = ? AND project_id = ?`).run(...Object.values(fields), rowId, id);
  return NextResponse.json(db.prepare('SELECT * FROM escalation_levels WHERE id = ?').get(rowId));
}
