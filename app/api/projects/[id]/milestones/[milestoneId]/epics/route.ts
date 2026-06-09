import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string; milestoneId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { milestoneId } = await params;
  const db = await getDb();
  const epics = await db.all(
    `SELECT a.id, a.phase, a.no, a.activity, a.status, a.completion_pct, a.plan_start, a.plan_end, a.jira_key, a.parent_id
     FROM milestone_epics me
     JOIN activities a ON a.id = me.activity_id
     WHERE me.milestone_id = ?
     ORDER BY a.order_idx, a.id`,
    milestoneId
  );
  return NextResponse.json(epics);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { milestoneId } = await params;
  const body = await req.json();
  const db = await getDb();
  try {
    await db.run(
      'INSERT OR IGNORE INTO milestone_epics (milestone_id, activity_id) VALUES (?,?)',
      milestoneId, body.activity_id
    );
  } catch {
    // already linked — ignore
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { milestoneId } = await params;
  const { searchParams } = new URL(req.url);
  const activityId = searchParams.get('activity_id');
  const db = await getDb();
  await db.run('DELETE FROM milestone_epics WHERE milestone_id = ? AND activity_id = ?', milestoneId, activityId);
  return NextResponse.json({ ok: true });
}
