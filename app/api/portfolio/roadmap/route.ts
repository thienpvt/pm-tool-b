import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();

  const projects = user.is_admin
    ? await db.all(`SELECT p.*, c.name as program_name, c.industry as program_industry
                    FROM projects p LEFT JOIN customers c ON p.customer_id = c.id
                    ORDER BY p.created_at DESC`) as any[]
    : await db.all(`SELECT p.*, c.name as program_name, c.industry as program_industry
                    FROM projects p LEFT JOIN customers c ON p.customer_id = c.id
                    WHERE p.company_id = ? ORDER BY p.created_at DESC`, user.company_id) as any[];

  const programs = user.is_admin
    ? await db.all('SELECT * FROM customers ORDER BY name') as any[]
    : await db.all('SELECT * FROM customers WHERE company_id = ? ORDER BY name', user.company_id) as any[];

  const riskCounts = await db.all(
    `SELECT project_id, SUM(CASE WHEN status='Open' OR status='In Progress' THEN 1 ELSE 0 END) as open FROM risks GROUP BY project_id`
  ) as any[];
  const issueCounts = await db.all(
    `SELECT project_id, SUM(CASE WHEN status='Open' OR status='In Progress' THEN 1 ELSE 0 END) as open FROM issues GROUP BY project_id`
  ) as any[];
  const DONE_STATUSES_SQL = "'ANBM','Deployed','Done','UAT','QC Done','READY TO RELEASE','Passed QC','READY FOR RELEASE'";

  const activityTotals = await db.all(
    `SELECT project_id, COUNT(*) as total,
      SUM(CASE WHEN status IN (${DONE_STATUSES_SQL}) THEN 1 ELSE 0 END) as done
     FROM activities GROUP BY project_id`
  ) as any[];

  // Phase-level date range + completion per project
  const phaseStats = await db.all(`
    SELECT
      project_id, phase,
      MIN(CASE WHEN plan_start IS NOT NULL AND plan_start <> '' THEN plan_start END) AS phase_start,
      MAX(CASE WHEN plan_end   IS NOT NULL AND plan_end   <> '' THEN plan_end   END) AS phase_end,
      COUNT(*) AS total,
      SUM(CASE WHEN status IN (${DONE_STATUSES_SQL}) THEN 1 ELSE 0 END) AS done,
      MIN(CASE WHEN jira_key IS NOT NULL AND jira_key <> '' THEN jira_key END) AS epic_key
    FROM activities
    GROUP BY project_id, phase
  `) as any[];

  const riskMap  = Object.fromEntries(riskCounts.map((r: any)   => [r.project_id, r.open ?? 0]));
  const issueMap = Object.fromEntries(issueCounts.map((r: any)  => [r.project_id, r.open ?? 0]));
  const actMap   = Object.fromEntries(activityTotals.map((r: any) => [r.project_id, r]));

  const phaseMap: Record<number, any[]> = {};
  for (const ps of phaseStats) {
    if (!phaseMap[ps.project_id]) phaseMap[ps.project_id] = [];
    phaseMap[ps.project_id].push(ps);
  }

  const PHASE_ORDER = ['Initiation', 'Planning', 'Execution', 'Closing'];
  const nowMs = Date.now();

  const enriched = projects.map((p: any) => {
    const open_risks   = riskMap[p.id]  ?? 0;
    const open_issues  = issueMap[p.id] ?? 0;
    const actEntry = actMap[p.id];
    const completion_pct = actEntry?.total > 0 ? Math.round((actEntry.done / actEntry.total) * 100) : 0;
    const endMs = p.end_date ? new Date(p.end_date + 'T23:59:59').getTime() : null;
    const days_until_deadline = endMs ? Math.ceil((endMs - nowMs) / 86400000) : null;

    let rag: 'red' | 'amber' | 'green' = 'green';
    if (p.current_phase !== 'Closing') {
      if ((days_until_deadline !== null && days_until_deadline < 0) || open_risks >= 3) {
        rag = 'red';
      } else if (
        (days_until_deadline !== null && days_until_deadline <= 14) ||
        open_risks >= 1 || open_issues >= 1 ||
        (completion_pct < 30 && (actMap[p.id]?.total ?? 0) > 0)
      ) {
        rag = 'amber';
      }
    }

    const phases = (phaseMap[p.id] ?? [])
      .map((ps: any) => ({
        phase:          ps.phase,
        start_date:     ps.phase_start  ?? null,
        end_date:       ps.phase_end    ?? null,
        total:          Number(ps.total),
        done:           Number(ps.done),
        completion_pct: Number(ps.total) > 0 ? Math.round((Number(ps.done) / Number(ps.total)) * 100) : 0,
        epic_key:       ps.epic_key     ?? null,
      }))
      .sort((a: any, b: any) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase));

    return { ...p, open_risks, open_issues, completion_pct, days_until_deadline, rag, phases };
  });

  const byProgram = programs.map((c: any) => ({
    ...c,
    projects: enriched.filter((p: any) => p.customer_id === c.id),
  }));
  const noProgramProjects = enriched.filter((p: any) => !p.customer_id);

  return NextResponse.json({ programs: byProgram, noProgramProjects });
}
