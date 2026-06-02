import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string; milestoneId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id, milestoneId } = await params;
  const body = await req.json();
  const db = await getDb();
  await db.run(
    'UPDATE milestones SET name = ?, start_date = ?, end_date = ? WHERE id = ? AND project_id = ?',
    body.name ?? '', body.start_date ?? null, body.end_date ?? null, milestoneId, id
  );
  return NextResponse.json(await db.get('SELECT * FROM milestones WHERE id = ?', milestoneId));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, milestoneId } = await params;
  const db = await getDb();
  await db.run('DELETE FROM milestones WHERE id = ? AND project_id = ?', milestoneId, id);
  return NextResponse.json({ ok: true });
}
