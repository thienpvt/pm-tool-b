import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { assertProjectAccess, toAccessActor } from '@/lib/services/access';
import { statusPct, weightedProgress } from '@/lib/status-weights';
import { roadmapEpicRows } from '@/lib/repositories/portfolio.repo';

// Trả về cây epic → children theo phase cho một project, kèm tiến độ weighted-by-status.
// Dùng cho: expand phase trong Portfolio Roadmap + dialog chi tiết Epic.
export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

  // T-04-21 live read IDOR fix: assert ownership BEFORE the epic tree read.
  try {
    await assertProjectAccess(projectId, toAccessActor(user));
  } catch (e) {
    return serviceErrorResponse(e);
  }

  type ActivityRow = {
    id: number; phase: string | null; no: string | null; activity: string | null;
    status: string | null; plan_start: string | null; plan_end: string | null;
    jira_key: string | null; parent_id: number | null;
  };

  const rows = await roadmapEpicRows(projectId) as ActivityRow[];

  const childrenByParent: Record<number, ActivityRow[]> = {};
  for (const r of rows) {
    if (r.parent_id) (childrenByParent[r.parent_id] = childrenByParent[r.parent_id] ?? []).push(r);
  }

  const shape = (a: ActivityRow) => ({
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
        weighted_pct: kids.length > 0 ? weightedProgress(kids.map((k) => k.status)) : statusPct(epic.status),
        children: kids,
      };
    });

  return NextResponse.json({ epics });
}
