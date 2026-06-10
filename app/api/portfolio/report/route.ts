import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

// ─── Status weights (same as project weekly report) ───────────────────────────
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

// ─── GET: Full portfolio report data ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
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

  // Company scoping: admin sees all, regular user sees only their company
  const cc = user.is_admin ? '' : 'AND p.company_id = ?';
  const cp = user.is_admin ? [] : [user.company_id];

  // ─── Milestone mode (multi-select) ────────────────────────────────────────
  const milestoneIdsParam = searchParams.get('milestone_ids'); // "1,2,3"
  const milestoneProjectIds = new Set<number>();
  let milestoneEpicIds: Set<number> = new Set();
  type MilestoneInfoItem = { id: number; name: string; project_name: string; program_name: string; start_date: string; end_date: string };
  const selectedMilestones: MilestoneInfoItem[] = [];
  let milestoneMonth: string | null = null;

  if (milestoneIdsParam) {
    const ids = milestoneIdsParam.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    let periodMin: string | null = null;
    let periodMax: string | null = null;

    for (const msId of ids) {
      const ms = await db.get<{ id: number; project_id: number; name: string; start_date: string; end_date: string }>(
        'SELECT id, project_id, name, start_date, end_date FROM milestones WHERE id = ?', msId
      );
      if (!ms) continue;

      milestoneProjectIds.add(ms.project_id);
      const proj = await db.get<{ name: string; customer_id: number | null }>(
        'SELECT name, customer_id FROM projects WHERE id = ?', ms.project_id
      );
      let programName = '';
      if (proj?.customer_id) {
        const cust = await db.get<{ name: string }>('SELECT name FROM customers WHERE id = ?', proj.customer_id);
        programName = cust?.name ?? '';
      }
      selectedMilestones.push({ id: ms.id, name: ms.name, project_name: proj?.name ?? '', program_name: programName, start_date: ms.start_date, end_date: ms.end_date });

      const epicRows = await db.all<{ activity_id: number }>(
        'SELECT activity_id FROM milestone_epics WHERE milestone_id = ?', ms.id
      );
      for (const r of epicRows) milestoneEpicIds.add(r.activity_id);

      if (ms.start_date && (periodMin === null || ms.start_date < periodMin)) periodMin = ms.start_date;
      if (ms.end_date   && (periodMax === null || ms.end_date   > periodMax)) periodMax = ms.end_date;
    }

    if (periodMin) startParam = periodMin;
    if (periodMax) {
      endParam = periodMax;
      milestoneMonth = periodMax.slice(0, 7);
    }
  }

  const milestoneInfo = selectedMilestones.length > 0 ? selectedMilestones : null;

  // Milestone-project filter for SQL queries
  const _projIdList = [...milestoneProjectIds];
  const mpWhere  = _projIdList.length === 1 ? `AND p.id = ${_projIdList[0]}`          : _projIdList.length > 1 ? `AND p.id IN (${_projIdList.join(',')})` : '';
  const mpWhereR = _projIdList.length === 1 ? `AND r.project_id = ${_projIdList[0]}`  : _projIdList.length > 1 ? `AND r.project_id IN (${_projIdList.join(',')})` : '';
  const mpWhereI = _projIdList.length === 1 ? `AND i.project_id = ${_projIdList[0]}`  : _projIdList.length > 1 ? `AND i.project_id IN (${_projIdList.join(',')})` : '';
  const mpWhereA = _projIdList.length === 1 ? `AND a.project_id = ${_projIdList[0]}`  : _projIdList.length > 1 ? `AND a.project_id IN (${_projIdList.join(',')})` : '';

  const projects = await db.all(`
    SELECT p.*, c.name as program_name, c.industry as program_industry
    FROM projects p
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE 1=1 ${cc}
    ORDER BY p.created_at DESC
  `, ...cp) as any[];

  const programs = user.is_admin
    ? await db.all('SELECT * FROM customers ORDER BY name') as any[]
    : await db.all('SELECT * FROM customers WHERE company_id = ? ORDER BY name', user.company_id) as any[];

  const riskCounts = await db.all(`SELECT project_id, COUNT(*) as total, SUM(CASE WHEN status='Open' OR status='In Progress' THEN 1 ELSE 0 END) as open FROM risks GROUP BY project_id`) as any[];
  const issueCounts = await db.all(`SELECT project_id, COUNT(*) as total, SUM(CASE WHEN status='Open' OR status='In Progress' THEN 1 ELSE 0 END) as open FROM issues GROUP BY project_id`) as any[];

  // Fetch all activity statuses for weighted completion calculation
  const allActivityRows = await db.all(
    'SELECT id, project_id, no, parent_id, activity as epic_name, status, phase, plan_start, plan_end, actual_start, actual_end FROM activities'
  ) as { id: number; project_id: number; no: string; parent_id: number | null; epic_name: string; status: string; phase: string; plan_start?: string; plan_end?: string; actual_start?: string; actual_end?: string }[];

  // In milestone mode: restrict to only the milestone epics + their direct children
  const activityRows = milestoneProjectIds.size > 0 && milestoneEpicIds.size > 0
    ? allActivityRows.filter(row =>
        milestoneProjectIds.has(row.project_id) &&
        (row.no === 'EPIC'
          ? milestoneEpicIds.has(row.id)
          : (row.parent_id !== null && milestoneEpicIds.has(row.parent_id)))
      )
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

    // EPIC rows are containers — skip from phase/epic grouping (stats come from children)
    if (row.no === 'EPIC') continue;

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
  const donePlaceholders = DONE_STATUSES.map(() => '?').join(',');

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
  const topRisks = await db.all(`
    SELECT r.*, p.name as project_name, c.name as program_name
    FROM risks r
    JOIN projects p ON r.project_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE (r.status='Open' OR r.status='In Progress') ${cc} ${mpWhereR}
    ORDER BY CASE r.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, r.id DESC
    LIMIT 12
  `, ...cp) as any[];

  const topIssues = await db.all(`
    SELECT i.*, p.name as project_name, c.name as program_name
    FROM issues i
    JOIN projects p ON i.project_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE (i.status='Open' OR i.status='In Progress') ${cc} ${mpWhereI}
    ORDER BY CASE i.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, i.id DESC
    LIMIT 12
  `, ...cp) as any[];

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const plus30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const minus14 = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);

  // Upcoming milestones: not in any done status
  const upcomingMilestones = await db.all(`
    SELECT a.*, p.name as project_name, c.name as program_name
    FROM activities a
    JOIN projects p ON a.project_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE a.plan_end BETWEEN ? AND ?
      AND a.status NOT IN (${donePlaceholders}) ${cc} ${mpWhereA}
    ORDER BY a.plan_end ASC
    LIMIT 15
  `, todayStr, plus30, ...DONE_STATUSES, ...cp) as any[];

  // Recently completed: any done status, using actual_end
  const recentlyCompleted = await db.all(`
    SELECT a.*, p.name as project_name, c.name as program_name
    FROM activities a
    JOIN projects p ON a.project_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE a.status IN (${donePlaceholders})
      AND a.actual_end >= ? ${cc} ${mpWhereA}
    ORDER BY a.actual_end DESC
    LIMIT 10
  `, ...DONE_STATUSES, minus14, ...cp) as any[];

  // Completed in selected date range: any done status + actual_end in range
  const completedInRange = await db.all(`
    SELECT a.*, p.name as project_name, p.current_phase, c.name as program_name
    FROM activities a
    JOIN projects p ON a.project_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE a.status IN (${donePlaceholders})
      AND a.actual_end >= ?
      AND a.actual_end <= ? ${cc} ${mpWhereA}
    ORDER BY a.project_id, a.actual_end
  `, ...DONE_STATUSES, startParam, endParam, ...cp) as any[];

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
  const bugRows = milestoneMonth
    ? await db.all(`
        SELECT b.project_id, p.name as project_name, b.status, b.priority, COUNT(*) as cnt
        FROM bugs b
        JOIN projects p ON b.project_id = p.id
        WHERE b.snapshot_date = (
          SELECT MAX(b2.snapshot_date) FROM bugs b2
          WHERE b2.project_id = b.project_id
          AND b2.snapshot_date LIKE '${milestoneMonth}%'
          AND b2.snapshot_date != ''
        )
        AND b.snapshot_date LIKE '${milestoneMonth}%'
        AND b.snapshot_date != ''
        ${cc} ${mpWhere}
        GROUP BY b.project_id, p.name, b.status, b.priority
      `, ...cp) as { project_id: number; project_name: string; status: string; priority: string; cnt: number }[]
    : await db.all(`
        SELECT b.project_id, p.name as project_name, b.status, b.priority, COUNT(*) as cnt
        FROM bugs b
        JOIN projects p ON b.project_id = p.id
        WHERE b.snapshot_date = (
          SELECT MAX(b2.snapshot_date) FROM bugs b2
          WHERE b2.project_id = b.project_id AND b2.snapshot_date != ''
        )
        AND (b.snapshot_date IS NOT NULL AND b.snapshot_date != '')
        ${cc}
        GROUP BY b.project_id, p.name, b.status, b.priority
      `, ...cp) as { project_id: number; project_name: string; status: string; priority: string; cnt: number }[];

  // Build bug stats
  type BugProjectSummary = { projectId: number; projectName: string; total: number; byStatus: Record<string, number>; byPriority: Record<string, number> };
  const bugProjectMap: Record<number, BugProjectSummary> = {};
  const bugTotalByStatus: Record<string, number> = {};
  const bugTotalByPriority: Record<string, number> = {};
  let bugGrandTotal = 0;

  for (const row of bugRows) {
    const cnt = Number(row.cnt);
    if (!bugProjectMap[row.project_id]) {
      bugProjectMap[row.project_id] = { projectId: row.project_id, projectName: row.project_name, total: 0, byStatus: {}, byPriority: {} };
    }
    const bp = bugProjectMap[row.project_id];
    bp.total += cnt;
    bp.byStatus[row.status] = (bp.byStatus[row.status] ?? 0) + cnt;
    bp.byPriority[row.priority] = (bp.byPriority[row.priority] ?? 0) + cnt;
    bugTotalByStatus[row.status] = (bugTotalByStatus[row.status] ?? 0) + cnt;
    bugTotalByPriority[row.priority] = (bugTotalByPriority[row.priority] ?? 0) + cnt;
    bugGrandTotal += cnt;
  }

  const bugStats = {
    total: bugGrandTotal,
    byStatus: bugTotalByStatus,
    byPriority: bugTotalByPriority,
    byProject: Object.values(bugProjectMap).sort((a, b) => b.total - a.total),
  };

  // ─── Personnel stats ──────────────────────────────────────────────────────
  const pmWhere = user.is_admin ? '' : ' AND company_id = ?';
  const pmArgs: any[] = user.is_admin ? [] : [user.company_id];

  const internalPortfolioMembers = await db.all(
    `SELECT name, role FROM portfolio_members WHERE member_type = 'internal'${pmWhere}`,
    ...pmArgs
  ) as { name: string; role: string }[];

  const allTeamMembersForPersonnel = await db.all(`
    SELECT tm.name, p.name as project_name
    FROM team_members tm
    JOIN projects p ON tm.project_id = p.id
    WHERE 1=1 ${cc}
  `, ...cp) as { name: string; project_name: string }[];

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
    const companyRow = await db.get<{ headcount_quota: number }>(
      'SELECT headcount_quota FROM companies WHERE id = ?', user.company_id
    );
    const headcountQuota = Number(companyRow?.headcount_quota ?? 0);

    const membersFte = await db.all(`
      SELECT
        pm.member_category,
        pm.overhead_remaining,
        COALESCE((
          SELECT SUM(
            CASE WHEN tm.capacity_json IS NOT NULL AND length(trim(tm.capacity_json)) > 2
                 THEN CAST((tm.capacity_json::jsonb ->> TO_CHAR(CURRENT_DATE, 'YYYY-MM')) AS FLOAT)
                 ELSE 0
            END
          )
          FROM team_members tm
          JOIN projects p ON p.id = tm.project_id
          WHERE LOWER(TRIM(tm.name)) = LOWER(TRIM(pm.name))
            AND p.company_id = pm.company_id
        ), 0) AS current_month_fte
      FROM portfolio_members pm
      WHERE pm.member_type = 'internal' AND pm.company_id = ?
    `, user.company_id) as { member_category: string; overhead_remaining: number; current_month_fte: number }[];

    const deliveryFte = membersFte
      .filter(m => m.member_category !== 'overhead')
      .reduce((s, m) => s + (Number(m.current_month_fte) || 0), 0);
    const overheadProjectFte = membersFte
      .filter(m => m.member_category === 'overhead')
      .reduce((s, m) => s + (Number(m.current_month_fte) || 0), 0);
    const overheadRemainingFte = membersFte
      .filter(m => m.member_category === 'overhead')
      .reduce((s, m) => s + (Number(m.overhead_remaining) || 0), 0);
    const totalUsedFte = deliveryFte + overheadProjectFte + overheadRemainingFte;
    const benchFte = Math.max(0, headcountQuota - totalUsedFte);

    const programAllocRows = await db.all(`
      SELECT
        c.name AS program_name,
        COALESCE(ppa.allocated_headcount, 0) AS allocated,
        COALESCE((
          SELECT ROUND(CAST(SUM(
            COALESCE(
              CASE WHEN tm.capacity_json IS NOT NULL AND length(trim(tm.capacity_json)) > 2
                   THEN CAST((tm.capacity_json::jsonb ->> TO_CHAR(CURRENT_DATE, 'YYYY-MM')) AS FLOAT)
                   ELSE NULL
              END, 0
            )
          ) AS NUMERIC), 1)
          FROM team_members tm
          JOIN projects p ON p.id = tm.project_id
          WHERE p.customer_id = c.id AND p.company_id = ?
        ), 0) AS actual
      FROM customers c
      LEFT JOIN portfolio_program_allocations ppa ON ppa.program_id = c.id AND ppa.company_id = ?
      WHERE c.company_id = ?
      ORDER BY c.name
    `, user.company_id, user.company_id, user.company_id) as { program_name: string; allocated: number; actual: number }[];

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
  const portfolioMilestones = await db.all(`
    SELECT m.id, m.project_id, m.name, m.start_date, m.end_date,
           p.name as project_name, COALESCE(c.name, '') as program_name
    FROM milestones m
    JOIN projects p ON m.project_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE 1=1 ${cc}
    ORDER BY m.start_date DESC, m.name
  `, ...cp) as { id: number; project_id: number; name: string; start_date: string; end_date: string; project_name: string; program_name: string }[];

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
  const body = await req.json() as { portfolioData: PortfolioPayload; language?: string };
  const { portfolioData } = body;
  const lang = (portfolioData.language ?? body.language ?? 'Vietnamese') === 'English' ? 'English' : 'Vietnamese';

  const db = await getDb();
  const dbKey = (await db.get("SELECT value FROM settings WHERE key='anthropic_api_key'") as any)?.value;
  const apiKey = process.env.ANTHROPIC_API_KEY || dbKey;
  if (!apiKey) return NextResponse.json({ error: 'NO_API_KEY' }, { status: 503 });

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
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return NextResponse.json({ report: text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'AI generation failed' }, { status: 500 });
  }
}
