import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { statusPct, weightedProgress } from '@/lib/status-weights';

// Trả về cây epic → children theo phase cho một project, kèm tiến độ weighted-by-status.
// Dùng cho: expand phase trong Portfolio Roadmap + dialog chi tiết Epic.
export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

  const db = await getDb();

  const rows = await db.all(
    `SELECT id, phase, no, activity, status, plan_start, plan_end, jira_key, parent_id, order_idx
     FROM activities WHERE project_id = ? ORDER BY order_idx, id`,
    projectId
  ) as any[];

  const childrenByParent: Record<number, any[]> = {};
  for (const r of rows) {
    if (r.parent_id) (childrenByParent[r.parent_id] = childrenByParent[r.parent_id] ?? []).push(r);
  }

  const shape = (a: any) => ({
    id: a.id, phase: a.phase, no: a.no, activity: a.activity, status: a.status,
    plan_start: a.plan_start || null, plan_end: a.plan_end || null, jira_key: a.jira_key || null,
  });

  const epics = rows
    .filter(r => r.no === 'EPIC')
    .map(epic => {
      const kids = (childrenByParent[epic.id] ?? []).map(c => ({
        ...shape(c),
        weighted_pct: statusPct(c.status),
      }));
      return {
        ...shape(epic),
        child_count: kids.length,
        weighted_pct: kids.length > 0 ? weightedProgress(kids.map((k: any) => k.status)) : statusPct(epic.status),
        children: kids,
      };
    });

  return NextResponse.json({ epics });
}
