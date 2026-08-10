import {
  issueCountsByProject,
  listPortfolioProjects,
  riskCountsByProject,
  roadmapActivityTotals,
  roadmapPhaseStats,
} from '@/lib/repositories/portfolio.repo';
import { listCompanyPrograms } from '@/lib/repositories/programs.repo';
import type { AccessActor } from './access';

const ROADMAP_DONE_STATUSES = [
  'ANBM', 'Deployed', 'Done', 'UAT', 'QC Done', 'READY TO RELEASE', 'Passed QC', 'READY FOR RELEASE',
] as const;

/**
 * Portfolio roadmap aggregate (GET /api/portfolio/roadmap).
 *
 * Company-scoped via actor.company_id + is_admin bypass.
 *
 * RAG thresholds below are the inline hand-roll from the pre-extraction route
 * (`open_risks >= 3` → red, `<= 14` days → amber). They DIVERGE from
 * `lib/rag.ts:calculateRAG`. Extracted verbatim (behavior freeze). Reconciliation
 * is a separate HYG-02 commit, not a silent fix inside this refactor.
 */
export async function getRoadmap(actor: AccessActor) {
  const [projects, programs, riskCounts, issueCounts, activityTotals, phaseStats] = await Promise.all([
    listPortfolioProjects(actor.company_id, Boolean(actor.is_admin)) as Promise<any[]>,
    listCompanyPrograms(actor.company_id, Boolean(actor.is_admin)) as Promise<any[]>,
    riskCountsByProject() as Promise<any[]>,
    issueCountsByProject() as Promise<any[]>,
    roadmapActivityTotals(ROADMAP_DONE_STATUSES) as Promise<any[]>,
    roadmapPhaseStats(ROADMAP_DONE_STATUSES) as Promise<any[]>,
  ]);

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

    // INLINE RAG — diverges from lib/rag.ts:calculateRAG. Do not substitute. (HYG-02 deferred)
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

  return { programs: byProgram, noProgramProjects };
}
