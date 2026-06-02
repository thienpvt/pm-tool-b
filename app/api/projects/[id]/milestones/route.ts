import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await getDb();
  const milestones = await db.all('SELECT * FROM milestones WHERE project_id = ? ORDER BY start_date, id', id);
  return NextResponse.json(milestones);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = await getDb();
  const r = await db.run(
    'INSERT INTO milestones (project_id, name, start_date, end_date) VALUES (?,?,?,?)',
    id, body.name ?? '', body.start_date ?? null, body.end_date ?? null
  );
  return NextResponse.json(await db.get('SELECT * FROM milestones WHERE id = ?', r.lastInsertRowid), { status: 201 });
}
