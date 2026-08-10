import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { statusWeight, DONE_STATUSES } from '@/lib/status-weights';
import { calculateRAG, DEFAULT_RAG_CONFIG } from '@/lib/rag';
import { companyRagConfig } from '@/lib/repositories/rag-config.repo';
import { listCompanyPrograms } from '@/lib/repositories/programs.repo';
import { resolveAnthropicCredentials } from '@/lib/integrations/credentials';
import { createMessage } from '@/lib/integrations/anthropic/client';
import { MODEL_OPUS_4_7 } from '@/lib/integrations/anthropic/models';
import { integrationErrorResponse } from '@/lib/api-errors';
import {
  completedPortfolioActivitiesBetween,
  internalPortfolioMembers as listInternalPortfolioMembers,
  issueCountsByProject,
  listPortfolioReportActivities,
  listPortfolioReportProjects,
  milestoneDateRanges,
  portfolioBugCounts,
  portfolioMemberFte,
  portfolioMilestoneSelection,
  portfolioProgramFillRates,
  portfolioReportMilestones,
  portfolioTeamMembers,
  recentlyCompletedPortfolioActivities,
  riskCountsByProject,
  topPortfolioIssues,
  topPortfolioRisks,
  upcomingPortfolioActivities,
  companyNameAndQuota,
} from '@/lib/repositories/portfolio.repo';

// ─── GET: Full portfolio report data ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);

  // Default to current Mon–Sun week
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  let startParam = searchParams.get('start') ?? monday.toISOString().slice(0, 10);
  let endParam   = searchParams.get('end')   ?? sunday.toISOString().slice(0, 10);

  // ─── Milestone mode (multi-select) ────────────────────────────────────────
  const milestoneIdsParam = searchParams.get('milestone_ids'); // "1,2,3"
  const milestoneProjectIds = new Set<number>();
  let milestoneEpicIds: Set<number> = new Set();
  type MilestoneInfoItem = { id: number; project_id: number; name: string; project_name: string; program_name: string; start_date: string; end_date: string };
  const selectedMilestones: MilestoneInfoItem[] = [];
  let milestoneMonth: string | null = null;

  if (milestoneIdsParam) {
    const ids = milestoneIdsParam.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const selection = await portfolioMilestoneSelection(
      ids,
      user.company_id,
      Boolean(user.is_admin),
    );
    for (const projectId of selection.projectIds) milestoneProjectIds.add(projectId);
    milestoneEpicIds = new Set(selection.activityIds);
    selectedMilestones.push(...selection.milestones);

    if (selection.periodMin) startParam = selection.periodMin;
    if (selection.periodMax) {
      endParam = selection.periodMax;
      milestoneMonth = selection.periodMax.slice(0, 7);
    }
  }

  const milestoneInfo = selectedMilestones.length > 0 ? selectedMilestones : null;

  const _projIdList = [...milestoneProjectIds];
  const _epicIdList = [...milestoneEpicIds];
  const [projects, programs, riskCounts, issueCounts, allActivityRows] = await Promise.all([
    listPortfolioReportProjects(user.company_id, Boolean(user.is_admin)) as Promise<any[]>,
    listCompanyPrograms(user.company_id, Boolean(user.is_admin)) as Promise<any[]>,
    riskCountsByProject() as Promise<any[]>,
    issueCountsByProject() as Promise<any[]>,
    listPortfolioReportActivities(),
  ]);

  // In milestone mode: only include activities explicitly stored in milestone_epics (direct match).
  // Do NOT expand EPICs to all their children — milestone_epics already stores exactly what was added.
  const activityRows = milestoneProjectIds.size > 0 && milestoneEpicIds.size > 0
    ? allActivityRows.filter(row => milestoneEpicIds.has(row.id))
    : allActivityRows;

  // Build weighted stats per project (matching project weekly report logic)
  type PhaseEntry = { total: number; done: number; weightedSum: number; planStartMin: string | null; planEndMax: string | null; actualStartMin: string | null; actualEndMax: string | null; };
  type ProjectStats = {
    total: number; weightedSum: number; done: number; inProgress: number; notStarted: number;
    phases: Record<string, PhaseEntry>;
  };
  const minDate = (a: string | null, b: string | null | undefined): string | null => {
    if (!a) return b ?? null;
    if (!b) return a;
    return a < b ? a : b;
  };
  const maxDate = (a: string | null, b: string | null | undefined): string | null => {
    if (!a) return b ?? null;
    if (!b) return a;
    return a > b ? a : b;
  };

  // First pass: collect EPIC activities to enable Epic-based grouping
  type EpicInfo = { project_id: number; epic_name: string; plan_start?: string; plan_end?: string; actual_start?: string; actual_end?: string };
  const epicById: Record<number, EpicInfo> = {};
  const projectHasEpics = new Set<number>();
  for (const row of activityRows) {
    if (row.no === 'EPIC') {
      epicById[row.id] = {
        project_id: row.project_id,
        epic_name: row.epic_name || row.phase || `Epic ${row.id}`,
        plan_start: row.plan_start,
        plan_end: row.plan_end,
        actual_start: row.actual_start,
        actual_end: row.actual_end,
      };
      projectHasEpics.add(row.project_id);
    }
  }

  // Second pass: build stats
  const actWeightMap: Record<number, ProjectStats> = {};
  for (const row of activityRows) {
    // EPIC rows are containers — sub-items are the actual activities
    if (row.no === 'EPIC') continue;

    if (!actWeightMap[row.project_id]) {
      actWeightMap[row.project_id] = { total: 0, weightedSum: 0, done: 0, inProgress: 0, notStarted: 0, phases: {} };
    }
    const w = statusWeight(row.status);
    const s = actWeightMap[row.project_id];
    s.total++;
    s.weightedSum += w;
    if (w >= 1) s.done++;
    else if (w > 0) s.inProgress++;
    else s.notStarted++;

    // Determine grouping key: Epic name (if parent is an EPIC) or phase
    let groupKey: string;
    if (projectHasEpics.has(row.project_id) && row.parent_id !== null && epicById[row.parent_id]) {
      groupKey = epicById[row.parent_id].epic_name;
    } else {
      groupKey = row.phase || 'General';
    }

    if (!s.phases[groupKey]) s.phases[groupKey] = { total: 0, done: 0, weightedSum: 0, planStartMin: null, planEndMax: null, actualStartMin: null, actualEndMax: null };
    const ph = s.phases[groupKey];
    ph.total++;
    ph.weightedSum += w;
    if (w >= 1) ph.done++;
    ph.planStartMin = minDate(ph.planStartMin, row.plan_start);
    ph.planEndMax = maxDate(ph.planEndMax, row.plan_end);
    ph.actualStartMin = minDate(ph.actualStartMin, row.actual_start);
    ph.actualEndMax = maxDate(ph.actualEndMax, row.actual_end);
  }

  // Ensure all EPICs appear in epicStats even if they have no child activities
  for (const epic of Object.values(epicById)) {
    const s = actWeightMap[epic.project_id];
    if (!s) continue;
    if (!s.phases[epic.epic_name]) {
      s.phases[epic.epic_name] = {
        total: 0, done: 0, weightedSum: 0,
        planStartMin: epic.plan_start ?? null,
        planEndMax: epic.plan_end ?? null,
        actualStartMin: epic.actual_start ?? null,
        actualEndMax: epic.actual_end ?? null,
      };
    }
  }

  const riskMap = Object.fromEntries(riskCounts.map((r: any) => [r.project_id, r]));
  const issueMap = Object.fromEntries(issueCounts.map((r: any) => [r.project_id, r]));

  const nowMs = Date.now();
  // RAG: build milestone date map for milestone mode
  const milestoneDateByProject: Record<number, { start: string | null; end: string | null }> = {};
  if (milestoneIdsParam) {
    for (const ms of selectedMilestones) {
      milestoneDateByProject[ms.project_id] = { start: ms.start_date ?? null, end: ms.end_date ?? null };
    }
  }

  // RAG: batch query milestone date ranges as fallback for projects missing own dates (date range mode)
  let msFallbackMap: Record<number, { min_s: string; max_e: string }> = {};
  if (!milestoneIdsParam) {
    const projectsMissingDates = projects.filter((p: any) => !p.start_date || !p.end_date);
    if (projectsMissingDates.length > 0) {
      const ids = projectsMissingDates.map((p: any) => p.id);
      const rows = await milestoneDateRanges(ids);
      msFallbackMap = Object.fromEntries(rows.map(r => [r.project_id, r]));
    }
  }

  // RAG: load company config once for all projects
  const ragCfg = (user.company_id
    ? await companyRagConfig(user.company_id)
    : null) ?? DEFAULT_RAG_CONFIG;

  const projectsForReport = milestoneProjectIds.size > 0
    ? projects.filter((p: any) => milestoneProjectIds.has(p.id))
    : projects;

  const enrichedProjects = projectsForReport.map((p: any) => {
    const open_risks: number = riskMap[p.id]?.open ?? 0;
    const open_issues: number = issueMap[p.id]?.open ?? 0;

    const actStats = actWeightMap[p.id] ?? { total: 0, weightedSum: 0, done: 0, inProgress: 0, notStarted: 0, phases: {} };
    const completion_pct = actStats.total > 0 ? Math.round((actStats.weightedSum / actStats.total) * 100) : 0;
    const total_activities = actStats.total;
    const done_activities = actStats.done;
    const in_progress_activities = actStats.inProgress;
    const not_started_activities = actStats.notStarted;
    const epicStats = Object.entries(actStats.phases)
      .map(([phase, { total: t, done: d, weightedSum: ws, planStartMin, planEndMax, actualStartMin, actualEndMax }]) => ({
        phase, total: t, done: d,
        pct: t > 0 ? Math.round((ws / t) * 100) : 0,
        start_date: actualStartMin ?? planStartMin ?? null,
        end_date: actualEndMax ?? planEndMax ?? null,
      }))
      .sort((a, b) => a.phase.localeCompare(b.phase));

    const effectiveStart = milestoneIdsParam
      ? milestoneDateByProject[p.id]?.start ?? null
      : p.start_date ?? msFallbackMap[p.id]?.min_s ?? null;
    const effectiveEnd = milestoneIdsParam
      ? milestoneDateByProject[p.id]?.end ?? null
      : p.end_date ?? msFallbackMap[p.id]?.max_e ?? null;

    const { rag, days_until_deadline } = calculateRAG({
      current_phase: p.current_phase,
      effective_start: effectiveStart,
      effective_end: effectiveEnd,
      completion_pct,
      total_activities,
      open_risks,
      open_issues,
      nowMs,
      config: ragCfg as any,
    });

    return {
      ...p,
      open_risks, total_risks: riskMap[p.id]?.total ?? 0,
      open_issues, total_issues: issueMap[p.id]?.total ?? 0,
      completion_pct, total_activities, done_activities,
      in_progress_activities, not_started_activities, epicStats,
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
    count: projectsForReport.filter((p: any) => p.current_phase === phase).length,
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

  // ─── Additional report data ────────────────────────────────────────────────
  const [topRisks, topIssues] = await Promise.all([
    topPortfolioRisks(user.company_id, Boolean(user.is_admin), _projIdList) as Promise<any[]>,
    topPortfolioIssues(user.company_id, Boolean(user.is_admin), _projIdList) as Promise<any[]>,
  ]);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const plus30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const minus14 = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);

  // Upcoming milestones: not in any done status
  const upcomingMilestones = await upcomingPortfolioActivities(
    user.company_id, Boolean(user.is_admin), _projIdList, _epicIdList,
    todayStr, plus30, DONE_STATUSES,
  ) as any[];

  // Recently completed: any done status, using actual_end
  const recentlyCompleted = await recentlyCompletedPortfolioActivities(
    user.company_id, Boolean(user.is_admin), _projIdList, _epicIdList,
    minus14, DONE_STATUSES,
  ) as any[];

  // Completed in selected date range: any done status + actual_end in range
  const completedInRange = await completedPortfolioActivitiesBetween(
    user.company_id, Boolean(user.is_admin), _projIdList, _epicIdList,
    startParam, endParam, DONE_STATUSES,
  ) as any[];

  // Group by project_id
  const completedByProject: Record<number, { project_name: string; program_name: string; current_phase: string; activities: any[] }> = {};
  for (const act of completedInRange) {
    if (!completedByProject[act.project_id]) {
      completedByProject[act.project_id] = {
        project_name: act.project_name,
        program_name: act.program_name ?? '',
        current_phase: act.current_phase,
        activities: [],
      };
    }
    completedByProject[act.project_id].activities.push(act);
  }

  // ─── Bug Report stats ─────────────────────────────────────────────────────
  // In milestone mode: pick the latest snapshot within the milestone's end-date month
  const bugRows = await portfolioBugCounts(
    user.company_id, Boolean(user.is_admin), _projIdList, milestoneMonth,
  ) as { project_id: number; project_name: string; status: string; priority: string; severity: string; cnt: number }[];

  // Build bug stats
  type BugProjectSummary = { projectId: number; projectName: string; total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; bySeverity: Record<string, number> };
  const bugProjectMap: Record<number, BugProjectSummary> = {};
  const bugTotalByStatus: Record<string, number> = {};
  const bugTotalByPriority: Record<string, number> = {};
  const bugTotalBySeverity: Record<string, number> = {};
  let bugGrandTotal = 0;

  for (const row of bugRows) {
    const cnt = Number(row.cnt);
    if (!bugProjectMap[row.project_id]) {
      bugProjectMap[row.project_id] = { projectId: row.project_id, projectName: row.project_name, total: 0, byStatus: {}, byPriority: {}, bySeverity: {} };
    }
    const bp = bugProjectMap[row.project_id];
    bp.total += cnt;
    bp.byStatus[row.status] = (bp.byStatus[row.status] ?? 0) + cnt;
    bp.byPriority[row.priority] = (bp.byPriority[row.priority] ?? 0) + cnt;
    if (row.severity) bp.bySeverity[row.severity] = (bp.bySeverity[row.severity] ?? 0) + cnt;
    bugTotalByStatus[row.status] = (bugTotalByStatus[row.status] ?? 0) + cnt;
    bugTotalByPriority[row.priority] = (bugTotalByPriority[row.priority] ?? 0) + cnt;
    if (row.severity) bugTotalBySeverity[row.severity] = (bugTotalBySeverity[row.severity] ?? 0) + cnt;
    bugGrandTotal += cnt;
  }

  const bugStats = {
    total: bugGrandTotal,
    byStatus: bugTotalByStatus,
    byPriority: bugTotalByPriority,
    bySeverity: bugTotalBySeverity,
    byProject: Object.values(bugProjectMap).sort((a, b) => b.total - a.total),
  };

  // ─── Personnel stats ──────────────────────────────────────────────────────
  const [internalPortfolioMembers, allTeamMembersForPersonnel] = await Promise.all([
    listInternalPortfolioMembers(user.company_id, Boolean(user.is_admin)),
    portfolioTeamMembers(user.company_id, Boolean(user.is_admin)),
  ]);

  const internalNameSet = new Set(internalPortfolioMembers.map((m: { name: string }) => m.name.toLowerCase().trim()));
  const internalTeamSlots = allTeamMembersForPersonnel.filter((tm: { name: string }) =>
    internalNameSet.has(tm.name.toLowerCase().trim())
  );

  const projAllocMap: Record<string, number> = {};
  for (const tm of internalTeamSlots) {
    projAllocMap[tm.project_name] = (projAllocMap[tm.project_name] ?? 0) + 1;
  }
  const projectAllocations = Object.entries(projAllocMap)
    .map(([projectName, memberCount]) => ({ projectName, memberCount }))
    .sort((a, b) => b.memberCount - a.memberCount);

  const personProjectMap: Record<string, string[]> = {};
  for (const tm of internalTeamSlots) {
    const key = tm.name.toLowerCase().trim();
    if (!personProjectMap[key]) personProjectMap[key] = [];
    if (!personProjectMap[key].includes(tm.project_name)) personProjectMap[key].push(tm.project_name);
  }
  const overallocated = Object.entries(personProjectMap)
    .filter(([, projs]) => projs.length > 2)
    .map(([nameLower, projects]) => {
      const member = internalPortfolioMembers.find((m: { name: string }) => m.name.toLowerCase().trim() === nameLower);
      return { name: member?.name ?? nameLower, role: member?.role ?? '', projects };
    })
    .sort((a, b) => b.projects.length - a.projects.length)
    .slice(0, 10);

  const personnelStats = {
    totalInternal: internalPortfolioMembers.length,
    totalAllocated: internalTeamSlots.length,
    projectAllocations,
    overallocated,
  };

  // ─── FTE-based resource stats ─────────────────────────────────────────────
  let fteStats = null;
  if (user.company_id) {
    const companyRow = await companyNameAndQuota(user.company_id);
    const headcountQuota = Number(companyRow?.headcount_quota ?? 0);

    const membersFte = await portfolioMemberFte(user.company_id);

    const deliveryFte = membersFte
      .filter(m => m.member_category !== 'overhead')
      .reduce((s, m) => s + (Number(m.current_month_fte) || 0), 0);
    const overheadProjectFte = membersFte
      .filter(m => m.member_category === 'overhead')
      .reduce((s, m) => s + (Number(m.current_month_fte) || 0), 0);
    // Overhead FTE model (matches /resources + /portfolio/resources `overheadRemainingOf`):
    // an overhead person is 1.0 FTE of overhead by default. The out-of-project overhead =
    // explicit `overhead_remaining` if set (>0), else `max(0, 1 − in-project FTE)`. Using the
    // raw column directly under-counted overhead to ~0% because it is usually left unset.
    const overheadRemainingFte = membersFte
      .filter(m => m.member_category === 'overhead')
      .reduce((s, m) => {
        const inProject = Number(m.current_month_fte) || 0;
        const explicit = Number(m.overhead_remaining) || 0;
        return s + (explicit > 0 ? explicit : Math.max(0, 1 - inProject));
      }, 0);
    const totalUsedFte = deliveryFte + overheadProjectFte + overheadRemainingFte;
    const benchFte = Math.max(0, headcountQuota - totalUsedFte);

    const programAllocRows = await portfolioProgramFillRates(user.company_id);

    const programFillRates = programAllocRows
      .map(r => ({
        programName: r.program_name,
        allocated: Number(r.allocated) || 0,
        actual: Number(r.actual) || 0,
        fillRate: Number(r.allocated) > 0 ? Math.round((Number(r.actual) / Number(r.allocated)) * 100) : 0,
      }))
      .sort((a, b) => b.fillRate - a.fillRate);

    const totalAllocSum = programFillRates.reduce((s, p) => s + p.allocated, 0);
    const totalActualSum = programFillRates.reduce((s, p) => s + p.actual, 0);
    const blockFillRate = totalAllocSum > 0 ? Math.round((totalActualSum / totalAllocSum) * 100) : 0;
    const fteShortfall = programFillRates
      .filter(p => p.allocated > p.actual)
      .reduce((s, p) => s + (p.allocated - p.actual), 0);

    fteStats = {
      headcountQuota,
      deliveryFte: parseFloat(deliveryFte.toFixed(1)),
      overheadProjectFte: parseFloat(overheadProjectFte.toFixed(1)),
      overheadRemainingFte: parseFloat(overheadRemainingFte.toFixed(1)),
      benchFte: parseFloat(benchFte.toFixed(1)),
      utilizationPct: headcountQuota > 0 ? Math.round((totalUsedFte / headcountQuota) * 100) : 0,
      blockFillRate,
      programFillRates,
      peopleNeeded: Math.ceil(fteShortfall),
      currentMonth: new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }),
    };
  }

  // Portfolio milestones list for mode selector dropdown
  const portfolioMilestones = await portfolioReportMilestones(
    user.company_id, Boolean(user.is_admin),
  ) as { id: number; project_id: number; name: string; start_date: string; end_date: string; project_name: string; program_name: string }[];

  return NextResponse.json({
    projects: enrichedProjects,
    programs: byProgram,
    noProgramProjects: noProgram,
    phaseDist,
    programBar,
    kpi: {
      totalProjects: projectsForReport.length,
      totalPrograms: programs.length,
      totalOpenRisks,
      totalOpenIssues,
      avgCompletion,
      activeProjects: projectsForReport.filter((p: any) => p.current_phase !== 'Closing').length,
    },
    topRisks,
    topIssues,
    upcomingMilestones,
    recentlyCompleted,
    completedByProject,
    personnelStats,
    fteStats,
    bugStats,
    portfolioMilestones,
    milestoneInfo,
    periodStart: startParam,
    periodEnd: endParam,
    reportDate: todayStr,
  });
}

// ─── POST: AI report generation ───────────────────────────────────────────────
type EpicStat = { phase: string; pct: number; done: number; total: number; start_date?: string | null; end_date?: string | null; };
type ProjectSummary = {
  name: string; program_name: string; current_phase: string;
  completion_pct: number; open_risks: number; open_issues: number;
  days_until_deadline: number | null; rag: 'red' | 'amber' | 'green';
  pm_name: string;
  done_activities?: number; in_progress_activities?: number; not_started_activities?: number; total_activities?: number;
  epicStats?: EpicStat[];
};
type ProgramGroup = { name: string; industry: string; projects: ProjectSummary[]; };
type RiskSummary = { priority: string; description: string; project_name: string; program_name: string; };
type MilestoneSummary = { plan_end: string; activity: string; project_name: string; };
type CompletedActivity = { activity: string; deliverable?: string; actual_end?: string; };
type CompletedGroup = { project_name: string; program_name: string; activities: CompletedActivity[]; };
type PortfolioPayload = {
  reportDate: string;
  periodStart?: string;
  periodEnd?: string;
  kpi: { totalProjects: number; totalPrograms: number; avgCompletion: number; activeProjects: number; totalOpenRisks: number; totalOpenIssues: number; };
  programs: ProgramGroup[];
  noProgramProjects: ProjectSummary[];
  topRisks?: RiskSummary[];
  topIssues?: RiskSummary[];
  upcomingMilestones?: MilestoneSummary[];
  completedByProject?: Record<string, CompletedGroup>;
  language: string;
};

export async function POST(req: NextRequest) {
  // WR-05: reject a malformed/oversized body with a JSON 400 instead of letting
  // req.json() reject the handler and surface a bare 500.
  let body: { portfolioData: PortfolioPayload; language?: string };
  try {
    body = await req.json() as { portfolioData: PortfolioPayload; language?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { portfolioData } = body;
  const lang = (portfolioData.language ?? body.language ?? 'Vietnamese') === 'English' ? 'English' : 'Vietnamese';

  const creds = await resolveAnthropicCredentials();
  if (!creds) return NextResponse.json({ error: 'NO_API_KEY' }, { status: 503 });

  const { kpi, programs, noProgramProjects, reportDate, topRisks, topIssues, upcomingMilestones, completedByProject, periodStart, periodEnd } = portfolioData;
  const allProjects = [...programs.flatMap(c => c.projects), ...noProgramProjects];
  const redProjects = allProjects.filter(p => p.rag === 'red');
  const amberProjects = allProjects.filter(p => p.rag === 'amber');
  const greenProjects = allProjects.filter(p => p.rag === 'green');

  const programLines = programs.map(c => {
    const lines = [`${c.name}${c.industry ? ` (${c.industry})` : ''} — ${c.projects.length} project(s):`];
    c.projects.forEach(p => {
      const deadline = p.days_until_deadline === null ? '' : p.days_until_deadline < 0 ? ` OVERDUE ${Math.abs(p.days_until_deadline)}d` : ` ${p.days_until_deadline}d left`;
      const statsLine = p.total_activities
        ? ` (${p.done_activities ?? 0}✓ ${p.in_progress_activities ?? 0}⟳ ${p.not_started_activities ?? 0}○ / ${p.total_activities} US)`
        : '';
      lines.push(`  - [${p.rag.toUpperCase()}] ${p.name} | ${p.current_phase} | ${p.completion_pct}%${statsLine} | risks:${p.open_risks} issues:${p.open_issues}${deadline}`);
      if (p.epicStats && p.epicStats.length > 0) {
        p.epicStats.forEach(e => {
          lines.push(`      ${e.phase}: ${e.pct}% (${e.done}/${e.total} US done)`);
        });
      }
    });
    return lines.join('\n');
  }).join('\n\n');

  const redLines = redProjects.length === 0 ? '- None' : redProjects.map(p => {
    const dl = p.days_until_deadline;
    return `- ${p.name} (${p.program_name || 'N/A'}) — ${p.completion_pct}%${dl !== null && dl < 0 ? ` | OVERDUE ${Math.abs(dl)} days` : dl !== null ? ` | Due in ${dl} days` : ''} | ${p.open_risks} risks, ${p.open_issues} issues`;
  }).join('\n');

  const riskLines = topRisks && topRisks.length > 0
    ? topRisks.slice(0, 8).map(r => `- [${r.priority}] ${r.description} — ${r.project_name} (${r.program_name || 'N/A'})`).join('\n')
    : '- None';

  const issueLines = topIssues && topIssues.length > 0
    ? topIssues.slice(0, 8).map(i => `- [${i.priority}] ${i.description} — ${i.project_name} (${i.program_name || 'N/A'})`).join('\n')
    : '- None';

  const milestoneLines = upcomingMilestones && upcomingMilestones.length > 0
    ? upcomingMilestones.slice(0, 10).map(m => `- ${m.plan_end} | ${m.activity} | ${m.project_name}`).join('\n')
    : '- None';

  const periodLabel = periodStart && periodEnd ? `${periodStart} → ${periodEnd}` : '';
  const completedLines = completedByProject && Object.keys(completedByProject).length > 0
    ? Object.values(completedByProject).map(g => {
        const actLines = g.activities.slice(0, 5).map(a => `    • ${a.activity}${a.deliverable ? ` → ${a.deliverable}` : ''}${a.actual_end ? ` (${a.actual_end})` : ''}`).join('\n');
        return `  ${g.project_name}${g.program_name ? ` (${g.program_name})` : ''}:\n${actLines}`;
      }).join('\n\n')
    : '  (No completed activities in the selected period)';

  const prompt = [
    `You are a senior PMO director. Write a comprehensive, CEO-appropriate portfolio status report.`,
    '',
    `Report Date: ${reportDate}`,
    periodLabel ? `Reporting Period: ${periodLabel}` : '',
    `Total Projects: ${kpi.totalProjects} across ${kpi.totalPrograms} programs`,
    `Active: ${kpi.activeProjects} | Avg Completion: ${kpi.avgCompletion}% (weighted by status)`,
    `Portfolio Health: ${redProjects.length} RED, ${amberProjects.length} AMBER, ${greenProjects.length} GREEN`,
    `Total Open Risks: ${kpi.totalOpenRisks} | Total Open Issues: ${kpi.totalOpenIssues}`,
    '',
    'PROJECTS BY PROGRAM (weighted progress | Done✓ InProgress⟳ NotStarted○):',
    programLines,
    '',
    'PROJECTS REQUIRING ATTENTION (RED):',
    redLines,
    '',
    'CRITICAL RISKS:',
    riskLines,
    '',
    'CRITICAL ISSUES:',
    issueLines,
    '',
    'UPCOMING MILESTONES (30 days):',
    milestoneLines,
    '',
    periodLabel ? `COMPLETED IN PERIOD (${periodLabel}):` : 'RECENTLY COMPLETED:',
    completedLines,
    '',
    `Write the report in ${lang}. Use this exact structure with all seven sections:`,
    'I. Executive Summary (3-4 sentences: overall portfolio health, key highlights, risk posture)',
    'II. Portfolio Health Status (RAG breakdown with one-line status per project, sorted RED first)',
    'III. Progress Report — Completed in Period (per-project bullet list of what was delivered during the reporting period)',
    'IV. Critical Risks & Issues (list top risks and issues with project context and recommended mitigations)',
    'V. Upcoming Milestones (key deliverables due within 30 days, highlight any at-risk ones)',
    'VI. Program Scorecard (one paragraph per program: their project health, weighted progress, concerns)',
    'VII. Recommended Actions (3-5 concrete CEO/steering committee decisions or escalations required)',
    '',
    'Target length: 700-900 words total. CEO-appropriate: direct, data-driven, action-oriented.',
    'Use professional PMO language. No filler phrases. Be specific with numbers and deadlines.',
    'For each RED project, explicitly recommend a specific action (escalation, resource injection, scope change, etc.).',
    'Note: completion % is weighted by status (Done=1.0, In Testing=0.6, In Progress=0.3, etc.) — not a simple done/total count.',
  ].filter(Boolean).join('\n');

  try {
    const { text } = await createMessage(creds, {
      model: MODEL_OPUS_4_7,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });
    return NextResponse.json({ report: text });
  } catch (e) {
    // Behavior change: adds a 120s SDK timeout where none existed (HYG-02)
    return integrationErrorResponse(e, { force500: true });
  }
}
