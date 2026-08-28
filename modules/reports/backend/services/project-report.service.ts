/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim extract from pre-layer routes */
import {
  listByStatuses,
  listDoneBetween,
  listForProjectReport,
  listPlannedBetweenExcludingStatuses,
  listStatusAndPhase,
} from '@/modules/projects/backend/repositories/activities.repo';
import {
  countsBySnapshot,
  maxSnapshotDate,
  snapshotDateOnOrBefore,
} from '@/modules/projects/backend/repositories/bugs.repo';
import { listNotClosedByPriority as issuesNotClosed, listOpenIssues } from '@/modules/projects/backend/repositories/issues.repo';
import { listEpicActivityIds, listMilestones } from '@/modules/projects/backend/repositories/milestones.repo';
import { getProjectForReport, getProjectWithCustomer } from '@/modules/projects/backend/repositories/projects.repo';
import { companyRagConfig } from '@/lib/repositories/rag-config.repo';
import { listNotClosedByPriority as risksNotClosed, listOpenRisks } from '@/modules/projects/backend/repositories/risks.repo';
import { listForReport as teamForReport } from '@/modules/projects/backend/repositories/team.repo';
import { calculateRAG, DEFAULT_RAG_CONFIG } from '@/lib/rag';
import { assertProjectAccess, type AccessActor } from '@/lib/services/access';
import { NotFoundError } from '@/lib/services/errors';

// Local status weights — copied verbatim from the pre-extraction report routes
// (those routes did not import lib/status-weights; keep byte-identical behavior).
const STATUS_WEIGHTS: Record<string, number> = {
  'ANBM': 1, 'STAGING-READY4TEST': 0.6, 'Deployed': 1, 'Done': 1,
  'In Dev': 0.2, 'In development': 0.2, 'In Progress': 0.3, 'In Review': 0.5,
  'In Testing': 0.6, 'New': 0, 'PENDING': 0.5, 'UAT': 1, 'QC Done': 1,
  'Ready For Dev': 0.2, 'Ready for Test': 0.6, 'Testing': 0.6, 'To Do': 0.1,
  'To-do': 0.1, 'REFINEMENT': 0.1, 'Re-Open': 0.7, 'READY TO RELEASE': 1,
  'Passed QC': 1, 'READY4TEST': 0.6, 'READY FOR RELEASE': 1, 'Blocked': 0,
};

function statusWeight(s: string): number { return STATUS_WEIGHTS[s] ?? 0; }

const DONE_STATUSES = Object.entries(STATUS_WEIGHTS).filter(([, w]) => w >= 1).map(([s]) => s);
const IN_PROGRESS_STATUSES = Object.entries(STATUS_WEIGHTS).filter(([, w]) => w > 0 && w < 1).map(([s]) => s);

function getWeekBounds(weekStart?: string): { start: Date; end: Date } {
  let start: Date;
  if (weekStart) {
    start = new Date(weekStart + 'T00:00:00');
  } else {
    start = new Date();
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    start.setHours(0, 0, 0, 0);
  }
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function fmt(d: Date) {
  return d.toISOString().split('T')[0];
}

export type WeeklyReportQuery = {
  start?: string | null;
  end?: string | null;
  week?: string | null;
};

/**
 * Weekly project report data (GET /api/projects/[id]/report).
 * Gains assertProjectAccess (route previously had no session check) — HYG-02.
 */
export async function getWeeklyProjectReport(
  projectId: number | string,
  actor: AccessActor,
  query: WeeklyReportQuery = {},
) {
  await assertProjectAccess(projectId, actor);

  const startParam = query.start ?? null;
  const endParam = query.end ?? null;
  const weekStart = query.week ?? undefined;

  let startStr: string, endStr: string;
  if (startParam && endParam) {
    startStr = startParam;
    endStr = endParam;
  } else {
    const { start, end } = getWeekBounds(weekStart ?? undefined);
    startStr = fmt(start);
    endStr = fmt(end);
  }

  const project = await getProjectWithCustomer(projectId) as any;
  if (!project) throw new NotFoundError('Not found', 'project');

  const doneThisWeek = await listDoneBetween(projectId, startStr, endStr, DONE_STATUSES) as any[];

  const inProgress = await listByStatuses(projectId, IN_PROGRESS_STATUSES) as any[];

  const endDate = new Date(endStr + 'T23:59:59');
  const nextStart = fmt(new Date(endDate.getTime() + 1));
  const nextEnd = fmt(new Date(endDate.getTime() + 7 * 86400000));
  const nextWeekPlan = await listPlannedBetweenExcludingStatuses(
    projectId, nextStart, nextEnd, DONE_STATUSES,
  ) as any[];

  const openRisks = await listOpenRisks(projectId) as any[];

  const openIssues = await listOpenIssues(projectId) as any[];

  // Weighted stats from all US activities
  const allActivities = await listStatusAndPhase(projectId);

  const total = allActivities.length;
  let weightedSum = 0;
  let doneCount = 0;
  let inProgressCount = 0;
  let notStartedCount = 0;

  for (const act of allActivities) {
    const w = statusWeight(act.status);
    weightedSum += w;
    if (w >= 1) doneCount++;
    else if (w > 0) inProgressCount++;
    else notStartedCount++;
  }

  const completion_pct = total > 0 ? Math.round((weightedSum / total) * 100) : 0;

  // Epic stats: group by phase, pct = done_US / total_US
  const phaseMap: Record<string, { total: number; done: number }> = {};
  for (const act of allActivities) {
    const phase = act.phase || 'General';
    if (!phaseMap[phase]) phaseMap[phase] = { total: 0, done: 0 };
    phaseMap[phase].total++;
    if (statusWeight(act.status) >= 1) phaseMap[phase].done++;
  }
  const epicStats = Object.entries(phaseMap)
    .map(([phase, { total: t, done: d }]) => ({
      phase,
      total: t,
      done: d,
      pct: t > 0 ? Math.round((d / t) * 100) : 0,
    }))
    .sort((a, b) => a.phase.localeCompare(b.phase));

  return {
    project,
    weekRange: { start: startStr, end: endStr },
    doneThisWeek,
    inProgress,
    nextWeekPlan,
    openRisks,
    openIssues,
    stats: {
      total,
      done: doneCount,
      inProgress: inProgressCount,
      notStarted: notStartedCount,
      completion_pct,
    },
    epicStats,
  };
}

export type ProjectReportQuery = {
  start?: string | null;
  end?: string | null;
  milestone_id?: string | null;
};

/**
 * Full project report data (GET /api/projects/[id]/project-report).
 * Gains assertProjectAccess (route previously had no session check) — HYG-02.
 *
 * BEHAVIOR FREEZE: companyRagConfig is resolved from `project.company_id`
 * (the project row), NOT from the actor/session company. That inversion is
 * arguably wrong for multi-tenant correctness of RAG thresholds, but changing
 * it is a behavior change deferred to a future phase. Do not "fix" it here.
 */
export async function getProjectReport(
  projectId: number | string,
  actor: AccessActor,
  query: ProjectReportQuery = {},
) {
  await assertProjectAccess(projectId, actor);

  const project = await getProjectForReport(projectId) as any;
  if (!project) throw new NotFoundError('Not found', 'project');

  const milestones = await listMilestones(projectId) as any[];

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  let startParam = query.start ?? '';
  let endParam = query.end ?? todayStr;
  let selectedMilestone: any = null;

  const milestoneIdParam = query.milestone_id ?? null;
  let milestoneActivityIds: Set<number> | null = null;

  if (milestoneIdParam) {
    const ms = milestones.find((m: any) => String(m.id) === milestoneIdParam);
    if (ms) {
      selectedMilestone = ms;
      if (ms.start_date) startParam = ms.start_date;
      if (ms.end_date) endParam = ms.end_date;

      // Fetch activity IDs that belong to this milestone
      const meRows = await listEpicActivityIds(milestoneIdParam);
      milestoneActivityIds = new Set(meRows.map(r => r.activity_id));
    }
  }

  if (!startParam) {
    startParam = project.start_date
      ?? new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  }

  // All activities for this project
  const allActivities = await listForProjectReport(projectId) as any[];

  // In milestone mode: scope to only activities in milestone_epics (direct match, no expansion needed
  // because the milestone page already stores both EPIC rows and their children)
  const scopedActivities = milestoneActivityIds !== null
    ? allActivities.filter(a => milestoneActivityIds!.has(a.id))
    : allActivities;

  // EPIC map (from scoped set)
  const epicById: Record<number, { name: string }> = {};
  for (const a of scopedActivities) {
    if (a.no === 'EPIC') epicById[a.id] = { name: a.activity || a.phase || `Epic ${a.id}` };
  }

  // Parent date map: for activities without own dates, fall back to parent's plan dates
  const parentDateMap: Record<number, { plan_start: string | null; plan_end: string | null }> = {};
  for (const a of allActivities) {
    if (a.no === 'EPIC') parentDateMap[a.id] = { plan_start: a.plan_start ?? null, plan_end: a.plan_end ?? null };
  }

  const nonEpic = scopedActivities.filter(a => a.no !== 'EPIC');

  // Overall stats
  let total = 0, weightedSum = 0, doneCount = 0, inProgressCount = 0, notStartedCount = 0;
  for (const a of nonEpic) {
    const w = statusWeight(a.status);
    total++;
    weightedSum += w;
    if (w >= 1) doneCount++;
    else if (w > 0) inProgressCount++;
    else notStartedCount++;
  }
  const completion_pct = total > 0 ? Math.round((weightedSum / total) * 100) : 0;

  // Epic/phase stats
  type PhEntry = { total: number; done: number; ws: number; ps: string | null; pe: string | null };
  const phaseMap: Record<string, PhEntry> = {};
  for (const a of nonEpic) {
    const key = (a.parent_id && epicById[a.parent_id])
      ? epicById[a.parent_id].name
      : (a.phase || 'General');
    if (!phaseMap[key]) phaseMap[key] = { total: 0, done: 0, ws: 0, ps: null, pe: null };
    const ph = phaseMap[key];
    const w = statusWeight(a.status);
    ph.total++;
    ph.ws += w;
    if (w >= 1) ph.done++;
    if (a.plan_start && (!ph.ps || a.plan_start < ph.ps)) ph.ps = a.plan_start;
    if (a.plan_end && (!ph.pe || a.plan_end > ph.pe)) ph.pe = a.plan_end;
  }
  const epicStats = Object.entries(phaseMap).map(([phase, v]) => ({
    phase,
    total: v.total,
    done: v.done,
    pct: v.total > 0 ? Math.round((v.ws / v.total) * 100) : 0,
    plan_start: v.ps,
    plan_end: v.pe,
  })).sort((a, b) => a.phase.localeCompare(b.phase));

  // Completed in period (date range = report period label, not an activity filter)
  // Priority: own actual/plan end → parent plan end/start → no date (excluded from section, still in overall %)
  const completedInPeriod = nonEpic.filter(a => {
    if (statusWeight(a.status) < 1) return false;
    const ae = a.actual_end ?? a.plan_end;
    if (ae) return ae >= startParam && ae <= endParam;
    // Fallback: parent dates
    if (a.parent_id != null) {
      const pd = parentDateMap[a.parent_id];
      if (pd) {
        const pDate = pd.plan_end ?? pd.plan_start;
        if (pDate) return pDate >= startParam && pDate <= endParam;
      }
    }
    return false;
  });

  // Upcoming (not done, plan_end in next 30 days from today)
  const plus30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const upcomingActivities = nonEpic
    .filter(a => statusWeight(a.status) < 1 && a.plan_end && a.plan_end >= todayStr && a.plan_end <= plus30)
    .slice(0, 15);

  // Risks & Issues not Closed
  const openRisks = await risksNotClosed(projectId) as any[];

  const openIssues = await issuesNotClosed(projectId) as any[];

  // Bug snapshot — in milestone mode use closest snapshot <= milestone end date; else use latest
  const bugSnapshotRow = milestoneIdParam
    ? await snapshotDateOnOrBefore(projectId, endParam)
    : await maxSnapshotDate(projectId);
  const bugSnapshotDate = bugSnapshotRow?.snapshot_date ?? null;

  let bugTotal = 0;
  const bugByStatus: Record<string, number> = {};
  const bugByPriority: Record<string, number> = {};

  if (bugSnapshotDate) {
    const bugRows = await countsBySnapshot(projectId, bugSnapshotDate);
    for (const r of bugRows) {
      const cnt = Number(r.cnt);
      bugByStatus[r.status] = (bugByStatus[r.status] ?? 0) + cnt;
      bugByPriority[r.priority] = (bugByPriority[r.priority] ?? 0) + cnt;
      bugTotal += cnt;
    }
  }

  // RAG
  const nowMs = Date.now();
  const effectiveStart = milestoneIdParam
    ? selectedMilestone?.start_date ?? null
    : project.start_date ?? null;
  const effectiveEnd = milestoneIdParam
    ? selectedMilestone?.end_date ?? null
    : project.end_date ?? null;
  // BEHAVIOR FREEZE: RAG config from project.company_id, NOT actor.company_id.
  // Recorded inversion — do not "fix" to session company here.
  const ragCfg = await companyRagConfig(project.company_id) ?? DEFAULT_RAG_CONFIG;
  const { rag, days_until_deadline } = calculateRAG({
    current_phase: project.current_phase,
    effective_start: effectiveStart,
    effective_end: effectiveEnd,
    completion_pct,
    total_activities: total,
    open_risks: openRisks.length,
    open_issues: openIssues.length,
    nowMs,
    config: ragCfg as any,
  });

  // Team members
  const teamRows = await teamForReport(projectId);

  const currentMonth = (milestoneIdParam ? endParam : todayStr).slice(0, 7);
  type TM = { name: string; domain: string; role: string; capacity: number };
  const teamData: TM[] = teamRows.map(m => {
    let cap = 0;
    try { const c = JSON.parse(m.capacity_json || '{}'); cap = parseFloat(c[currentMonth] ?? 0) || 0; } catch {}
    return { name: m.name || '—', domain: m.domain || 'General', role: m.role || '—', capacity: cap };
  });

  // Task allocation: count ALL child activities (date range = report label, not a filter)
  // In milestone mode: nonEpic is already scoped to milestone activities
  const periodTaskActivities = nonEpic;

  const taskCountByName: Record<string, number> = {};
  for (const a of periodTaskActivities) {
    const name = (a.accountable ?? '').trim();
    if (name) taskCountByName[name] = (taskCountByName[name] ?? 0) + 1;
  }
  const totalPeriodTasks = periodTaskActivities.length;

  const tmNameMap: Record<string, { role: string; domain: string }> = {};
  for (const m of teamRows) {
    if (m.name?.trim()) tmNameMap[m.name.trim()] = { role: m.role || '—', domain: m.domain || '—' };
  }

  const taskAllocation = Object.entries(taskCountByName)
    .map(([name, count]) => ({
      name,
      count,
      pct: totalPeriodTasks > 0 ? Math.round((count / totalPeriodTasks) * 100) : 0,
      role: tmNameMap[name]?.role ?? '—',
      domain: tmNameMap[name]?.domain ?? '—',
    }))
    .sort((a, b) => b.count - a.count);

  const domainMap: Record<string, TM[]> = {};
  for (const m of teamData) {
    if (!domainMap[m.domain]) domainMap[m.domain] = [];
    domainMap[m.domain].push(m);
  }

  const teamStats = (teamData.length > 0 || taskAllocation.length > 0) ? {
    total: teamData.length,
    currentMonth,
    fullTime: teamData.filter(m => m.capacity >= 0.8).length,
    partTime: teamData.filter(m => m.capacity > 0 && m.capacity < 0.8).length,
    overloaded: teamData.filter(m => m.capacity > 1.0),
    byDomain: Object.entries(domainMap).map(([domain, members]) => ({ domain, members })),
    taskAllocation,
    totalPeriodTasks,
  } : null;

  // Milestone stats (progress per milestone) — only computed in date range mode
  type MilestoneStat = { id: number; name: string; start_date: string | null; end_date: string | null; total: number; done: number; pct: number };
  const milestoneStats: MilestoneStat[] = [];
  if (!milestoneIdParam && milestones.length > 0) {
    for (const ms of milestones) {
      const msActRows = await listEpicActivityIds(ms.id as number);
      const msIds = new Set(msActRows.map(r => r.activity_id));
      const msActs = allActivities.filter(a => msIds.has(a.id) && a.no !== 'EPIC');
      let msTotalWs = 0, msDone = 0;
      for (const a of msActs) {
        const w = statusWeight(a.status);
        msTotalWs += w;
        if (w >= 1) msDone++;
      }
      milestoneStats.push({
        id: ms.id,
        name: ms.name,
        start_date: ms.start_date ?? null,
        end_date: ms.end_date ?? null,
        total: msActs.length,
        done: msDone,
        pct: msActs.length > 0 ? Math.round((msTotalWs / msActs.length) * 100) : 0,
      });
    }
  }

  return {
    project: { ...project, rag, days_until_deadline },
    milestones,
    selectedMilestone,
    periodStart: startParam,
    periodEnd: endParam,
    stats: { total, done: doneCount, inProgress: inProgressCount, notStarted: notStartedCount, completion_pct },
    epicStats,
    completedInPeriod,
    upcomingActivities,
    openRisks,
    openIssues,
    bugStats: bugTotal > 0 ? { total: bugTotal, byStatus: bugByStatus, byPriority: bugByPriority, snapshotDate: bugSnapshotDate } : null,
    teamStats,
    milestoneStats,
  };
}
