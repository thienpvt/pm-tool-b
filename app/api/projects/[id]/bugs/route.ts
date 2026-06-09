import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await getDb();
  const bugs = await db.all(
    'SELECT * FROM bugs WHERE project_id = ? ORDER BY created_at DESC',
    id,
  );
  return NextResponse.json(bugs);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { bugs, replace } = await req.json();
  if (!Array.isArray(bugs)) return NextResponse.json({ error: 'bugs must be array' }, { status: 400 });

  const db = await getDb();

  if (replace !== false) {
    await db.run('DELETE FROM bugs WHERE project_id = ?', id);
  }

  let inserted = 0;
  for (const bug of bugs) {
    await db.run(
      `INSERT INTO bugs (project_id, issue_type, issue_key, issue_id, summary, assignee, reporter, priority, status, resolution, created)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      bug.issue_type ?? '',
      bug.issue_key ?? '',
      bug.issue_id ?? '',
      bug.summary ?? '',
      bug.assignee ?? '',
      bug.reporter ?? '',
      bug.priority ?? 'Medium',
      bug.status ?? 'To Do',
      bug.resolution ?? '',
      bug.created ?? '',
    );
    inserted++;
  }

  return NextResponse.json({ inserted });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await getDb();
  await db.run('DELETE FROM bugs WHERE project_id = ?', id);
  return NextResponse.json({ ok: true });
}
