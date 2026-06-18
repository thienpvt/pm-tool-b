import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await getDb();
  const url = new URL(req.url);

  // Return list of available snapshot dates
  if (url.searchParams.get('list_dates') === '1') {
    const dates = await db.all<{ snapshot_date: string; count: number }>(
      `SELECT snapshot_date, COUNT(*) as count FROM bugs
       WHERE project_id = ? AND snapshot_date != ''
       GROUP BY snapshot_date ORDER BY snapshot_date DESC`,
      id,
    );
    return NextResponse.json(dates);
  }

  const date = url.searchParams.get('date');
  let bugs;

  if (date) {
    bugs = await db.all(
      'SELECT * FROM bugs WHERE project_id = ? AND snapshot_date = ? ORDER BY created_at',
      id, date,
    );
  } else {
    // Fall back to latest snapshot, or all rows if no snapshots exist
    const latest = await db.get<{ snapshot_date: string }>(
      `SELECT snapshot_date FROM bugs WHERE project_id = ? AND snapshot_date != ''
       ORDER BY snapshot_date DESC LIMIT 1`,
      id,
    );
    if (latest) {
      bugs = await db.all(
        'SELECT * FROM bugs WHERE project_id = ? AND snapshot_date = ? ORDER BY created_at',
        id, latest.snapshot_date,
      );
    } else {
      bugs = await db.all(
        'SELECT * FROM bugs WHERE project_id = ? ORDER BY created_at',
        id,
      );
    }
  }

  return NextResponse.json(bugs);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { bugs, snapshot_date } = await req.json();
  if (!Array.isArray(bugs)) return NextResponse.json({ error: 'bugs must be array' }, { status: 400 });

  const db = await getDb();
  const date = snapshot_date || new Date().toISOString().split('T')[0];

  // Replace only the data for this specific snapshot date
  await db.run('DELETE FROM bugs WHERE project_id = ? AND snapshot_date = ?', id, date);

  let inserted = 0;
  for (const bug of bugs) {
    await db.run(
      `INSERT INTO bugs
         (project_id, issue_type, issue_key, issue_id, summary, assignee, reporter,
          priority, severity, status, resolution, created, snapshot_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      bug.issue_type ?? '',
      bug.issue_key ?? '',
      bug.issue_id ?? '',
      bug.summary ?? '',
      bug.assignee ?? '',
      bug.reporter ?? '',
      bug.priority ?? 'Medium',
      bug.severity ?? '',
      bug.status ?? 'To Do',
      bug.resolution ?? '',
      bug.created ?? '',
      date,
    );
    inserted++;
  }

  return NextResponse.json({ inserted, snapshot_date: date });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await getDb();
  const url = new URL(req.url);
  const date = url.searchParams.get('date');

  if (date) {
    await db.run('DELETE FROM bugs WHERE project_id = ? AND snapshot_date = ?', id, date);
  } else {
    await db.run('DELETE FROM bugs WHERE project_id = ?', id);
  }
  return NextResponse.json({ ok: true });
}
