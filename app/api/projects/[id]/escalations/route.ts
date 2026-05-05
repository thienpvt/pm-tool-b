import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await getDb();
  return NextResponse.json(await db.all('SELECT * FROM escalation_levels WHERE project_id = ? ORDER BY level DESC', id));
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = await getDb();
  const { id: rowId, ...fields } = body;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  await db.run(`UPDATE escalation_levels SET ${sets} WHERE id = ? AND project_id = ?`, ...Object.values(fields), rowId, id);
  return NextResponse.json(await db.get('SELECT * FROM escalation_levels WHERE id = ?', rowId));
}
