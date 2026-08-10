import {
  activityCompletionByProject,
  issueCountsByProject,
  listPortfolioProjects,
  riskCountsByProject,
} from '@/lib/repositories/portfolio.repo';
import { listPrograms } from '@/lib/repositories/programs.repo';
import type { AccessActor } from './access';

/**
 * Portfolio home aggregate (GET /api/portfolio).
 *
 * Company-scoped: filters by actor.company_id with is_admin bypass.
 * Does NOT call assertProjectAccess — this is not project-scoped.
 *
 * RAG thresholds below are the inline hand-roll from the pre-extraction route
 * (`open_risks >= 3` → red, `<= 14` days → amber). They DIVERGE from
 * `lib/rag.ts:calculateRAG`. Extracted verbatim (behavior freeze). Reconciliation
 * is a separate HYG-02 commit, not a silent fix inside this refactor.
 */
export async function getPortfolioSummary(actor: AccessActor) {
  const [projects, programs, riskCounts, issueCounts, activityStats] = await Promise.all([
    listPortfolioProjects(actor.company_id, Boolean(actor.is_admin)) as Promise<any[]>,
    listPrograms(actor.company_id, Boolean(actor.is_admin)) as Promise<any[]>,
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

    // INLINE RAG — diverges from lib/rag.ts:calculateRAG. Do not substitute. (HYG-02 deferred)
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

  return {
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
  };
}
