import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  activityCompletionByProject,
  issueCountsByProject,
  listPortfolioProjects,
  riskCountsByProject,
} from '@/lib/repositories/portfolio.repo';
import { listPrograms } from '@/lib/repositories/programs.repo';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [projects, programs, riskCounts, issueCounts, activityStats] = await Promise.all([
    listPortfolioProjects(user.company_id, Boolean(user.is_admin)) as Promise<any[]>,
    listPrograms(user.company_id, Boolean(user.is_admin)) as Promise<any[]>,
    riskCountsByProject() as Promise<any[]>,
    issueCountsByProject() as Promise<any[]>,
    activityCompletionByProject() as Promise<any[]>,
  ]);

  const riskMap = Object.fromEntries(riskCounts.map((r: any) => [r.project_id, r]));
  const issueMap = Object.fromEntries(issueCounts.map((r: any) => [r.project_id, r]));
  const actMap = Object.fromEntries(activityStats.map((r: any) => [r.project_id, r]));

  const nowMs = Date.now();
  const enrichedProjects = projects.map((p: any) => {
    const open_risks: number = riskMap[p.id]?.open ?? 0;
    const open_issues: number = issueMap[p.id]?.open ?? 0;
    const completion_pct = Math.round(actMap[p.id]?.avg_pct ?? 0);
    const total_activities: number = actMap[p.id]?.total ?? 0;
    const done_activities: number = actMap[p.id]?.done ?? 0;

    const endMs = p.end_date ? new Date(p.end_date + 'T23:59:59').getTime() : null;
    const days_until_deadline = endMs ? Math.ceil((endMs - nowMs) / 86400000) : null;

    let rag: 'red' | 'amber' | 'green' = 'green';
    if (p.current_phase !== 'Closing') {
      if ((days_until_deadline !== null && days_until_deadline < 0) || open_risks >= 3) {
        rag = 'red';
      } else if (
        (days_until_deadline !== null && days_until_deadline <= 14) ||
        open_risks >= 1 || open_issues >= 1 ||
        (completion_pct < 30 && total_activities > 0)
      ) {
        rag = 'amber';
      }
    }

    return {
      ...p,
      open_risks, total_risks: riskMap[p.id]?.total ?? 0,
      open_issues, total_issues: issueMap[p.id]?.total ?? 0,
      completion_pct, total_activities, done_activities,
      days_until_deadline, rag,
    };
  });

  const byProgram = programs.map((c: any) => ({
    ...c,
    projects: enrichedProjects.filter((p: any) => p.customer_id === c.id),
  }));
  const noProgram = enrichedProjects.filter((p: any) => !p.customer_id);

  const phases = ['Initiation', 'Planning', 'Execution', 'Closing'];
  const phaseDist = phases.map(phase => ({
    phase,
    count: projects.filter((p: any) => p.current_phase === phase).length,
  }));

  const programBar = byProgram.map((c: any) => ({
    name: c.name,
    count: c.projects.length,
    active: c.projects.filter((p: any) => p.current_phase !== 'Closing').length,
  })).sort((a: any, b: any) => b.count - a.count).slice(0, 10);

  const totalOpenRisks = enrichedProjects.reduce((s: number, p: any) => s + p.open_risks, 0);
  const totalOpenIssues = enrichedProjects.reduce((s: number, p: any) => s + p.open_issues, 0);
  const avgCompletion = enrichedProjects.length
    ? Math.round(enrichedProjects.reduce((s: number, p: any) => s + p.completion_pct, 0) / enrichedProjects.length)
    : 0;

  return NextResponse.json({
    projects: enrichedProjects,
    programs: byProgram,
    noProgramProjects: noProgram,
    phaseDist,
    programBar,
    kpi: {
      totalProjects: projects.length,
      totalPrograms: programs.length,
      totalOpenRisks,
      totalOpenIssues,
      avgCompletion,
      activeProjects: projects.filter((p: any) => p.current_phase !== 'Closing').length,
    },
  });
}
