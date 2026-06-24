import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import { calculateRAG, DEFAULT_RAG_CONFIG } from '@/lib/rag';

type Params = { params: Promise<{ id: string }> };

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

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const db = await getDb();

  const project = await db.get(`
    SELECT p.*, c.name as customer_name, c.name as program_name
    FROM projects p
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE p.id = ?
  `, id) as any;
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const milestones = await db.all(
    'SELECT * FROM milestones WHERE project_id = ? ORDER BY start_date, id', id
  ) as any[];

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  let startParam = searchParams.get('start') ?? '';
  let endParam = searchParams.get('end') ?? todayStr;
  let selectedMilestone: any = null;

  const milestoneIdParam = searchParams.get('milestone_id');
  let milestoneActivityIds: Set<number> | null = null;

  if (milestoneIdParam) {
    const ms = milestones.find((m: any) => String(m.id) === milestoneIdParam);
    if (ms) {
      selectedMilestone = ms;
      if (ms.start_date) startParam = ms.start_date;
      if (ms.end_date) endParam = ms.end_date;

      // Fetch activity IDs that belong to this milestone
      const meRows = await db.all<{ activity_id: number }>(
        'SELECT activity_id FROM milestone_epics WHERE milestone_id = ?', milestoneIdParam
      );
      milestoneActivityIds = new Set(meRows.map(r => r.activity_id));
    }
  }

  if (!startParam) {
    startParam = project.start_date
      ?? new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  }

  // All activities for this project
  const allActivities = await db.all(
    `SELECT id, activity, deliverable, status, phase, plan_start, plan_end,
            actual_start, actual_end, no, parent_id, accountable
     FROM activities WHERE project_id = ? ORDER BY plan_start, id`,
    id
  ) as any[];

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

  // Completed in period
  const completedInPeriod = nonEpic.filter(a => {
    if (statusWeight(a.status) < 1) return false;
    const ae = a.actual_end ?? a.plan_end;
    if (!ae) return false;
    return ae >= startParam && ae <= endParam;
  });

  // Upcoming (not done, plan_end in next 30 days from today)
  const plus30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const upcomingActivities = nonEpic
    .filter(a => statusWeight(a.status) < 1 && a.plan_end && a.plan_end >= todayStr && a.plan_end <= plus30)
    .slice(0, 15);

  // Risks & Issues not Closed
  const openRisks = await db.all(
    `SELECT * FROM risks WHERE project_id = ? AND status != 'Closed'
     ORDER BY CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, id`,
    id
  ) as any[];

  const openIssues = await db.all(
    `SELECT * FROM issues WHERE project_id = ? AND status != 'Closed'
     ORDER BY CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, id`,
    id
  ) as any[];

  // Bug snapshot — in milestone mode use closest snapshot <= milestone end date; else use latest
  const bugSnapshotRow = milestoneIdParam
    ? await db.get<{ snapshot_date: string }>(
        `SELECT snapshot_date FROM bugs WHERE project_id = ? AND snapshot_date != '' AND snapshot_date <= ? ORDER BY snapshot_date DESC LIMIT 1`,
        id, endParam
      )
    : await db.get<{ snapshot_date: string }>(
        `SELECT MAX(snapshot_date) as snapshot_date FROM bugs WHERE project_id = ? AND snapshot_date != ''`,
        id
      );
  const bugSnapshotDate = bugSnapshotRow?.snapshot_date ?? null;

  let bugTotal = 0;
  const bugByStatus: Record<string, number> = {};
  const bugByPriority: Record<string, number> = {};

  if (bugSnapshotDate) {
    const bugRows = await db.all<{ status: string; priority: string; cnt: number }>(
      `SELECT status, priority, COUNT(*) as cnt FROM bugs
       WHERE project_id = ? AND snapshot_date = ?
       GROUP BY status, priority`,
      id, bugSnapshotDate
    );
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
  const ragCfg = await db.get<Record<string, unknown>>(
    'SELECT * FROM company_rag_config WHERE company_id = ?', project.company_id
  ) ?? DEFAULT_RAG_CONFIG;
  const { rag, spi: _spi, days_until_deadline } = calculateRAG({
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
  const teamRows = await db.all(
    'SELECT id, domain, role, name, capacity_json FROM team_members WHERE project_id = ? ORDER BY domain, name',
    id
  ) as { id: number; domain: string; role: string; name: string; capacity_json: string }[];

  const currentMonth = (milestoneIdParam ? endParam : todayStr).slice(0, 7);
  type TM = { name: string; domain: string; role: string; capacity: number };
  const teamData: TM[] = teamRows.map(m => {
    let cap = 0;
    try { const c = JSON.parse(m.capacity_json || '{}'); cap = parseFloat(c[currentMonth] ?? 0) || 0; } catch {}
    return { name: m.name || '—', domain: m.domain || 'General', role: m.role || '—', capacity: cap };
  });

  // Task allocation by accountable person (child activities only = no EPIC rows)
  // Scope: milestone activities if milestone mode; else activities overlapping the date range
  const periodTaskActivities = milestoneActivityIds !== null
    ? nonEpic
    : nonEpic.filter(a => {
        const ps = a.plan_start ?? a.actual_start ?? '';
        const pe = a.plan_end ?? a.actual_end ?? '';
        if (!ps && !pe) return true;
        return (!ps || ps <= endParam) && (!pe || pe >= startParam);
      });

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

  return NextResponse.json({
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
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  void id;

  const db = await getDb();
  const dbKey = (await db.get("SELECT value FROM settings WHERE key='anthropic_api_key'") as any)?.value;
  const apiKey = process.env.ANTHROPIC_API_KEY || dbKey;
  if (!apiKey) return NextResponse.json({ error: 'NO_API_KEY' }, { status: 503 });

  const body = await req.json();
  const { reportData, language = 'Vietnamese' } = body;
  const lang = language === 'English' ? 'English' : 'Vietnamese';
  const {
    project, periodStart, periodEnd, stats, epicStats,
    completedInPeriod, upcomingActivities, openRisks, openIssues, bugStats,
  } = reportData;

  const completedLines = completedInPeriod?.length === 0 ? '- None'
    : (completedInPeriod ?? []).map((a: any) =>
        `- ${a.activity}${a.deliverable ? ` → ${a.deliverable}` : ''}${a.actual_end ? ` [${a.actual_end}]` : ''}`
      ).join('\n');

  const upcomingLines = upcomingActivities?.length === 0 ? '- None scheduled'
    : (upcomingActivities ?? []).map((a: any) =>
        `- ${a.activity}${a.plan_end ? ` (due ${a.plan_end})` : ''}${a.status ? ` [${a.status}]` : ''}`
      ).join('\n');

  const riskLines = openRisks?.length === 0 ? '- None'
    : (openRisks ?? []).map((r: any) =>
        `- [${r.priority}] ${r.description}${r.status ? ` (${r.status})` : ''}${r.mitigation ? ` → Mitigation: ${r.mitigation}` : ''}`
      ).join('\n');

  const issueLines = openIssues?.length === 0 ? '- None'
    : (openIssues ?? []).map((r: any) =>
        `- [${r.priority}] ${r.description}${r.status ? ` (${r.status})` : ''}${r.mitigation ? ` → Resolution: ${r.mitigation}` : ''}`
      ).join('\n');

  const epicLines = epicStats?.length
    ? 'EPIC/PHASE PROGRESS:\n' + epicStats.map((e: any) =>
        `- ${e.phase}: ${e.pct}% (${e.done}/${e.total} done)`
      ).join('\n')
    : '';

  const bugLine = bugStats ? `Bug snapshot: ${bugStats.total} total bugs.` : '';

  const prompt = [
    `You are a senior project manager. Generate a comprehensive project status report.`,
    '',
    `Project: ${project.name}`,
    `Customer/Program: ${project.customer_name || project.program_name || 'N/A'}`,
    `PM: ${project.pm_name || 'N/A'}`,
    `Phase: ${project.current_phase}`,
    `Report Period: ${periodStart} → ${periodEnd}`,
    `Overall Progress: ${stats.completion_pct}% weighted (Done: ${stats.done}, In Progress: ${stats.inProgress}, Not Started: ${stats.notStarted}, Total: ${stats.total})`,
    `RAG Status: ${project.rag?.toUpperCase() || 'N/A'}`,
    `Deadline: ${project.end_date || 'N/A'}${project.days_until_deadline !== null && project.days_until_deadline !== undefined
      ? ` (${project.days_until_deadline < 0 ? `OVERDUE ${Math.abs(project.days_until_deadline)} days` : `${project.days_until_deadline} days remaining`})`
      : ''}`,
    bugLine,
    '',
    epicLines,
    '',
    `COMPLETED IN PERIOD (${completedInPeriod?.length ?? 0}):`,
    completedLines,
    '',
    `UPCOMING ACTIVITIES (${upcomingActivities?.length ?? 0}):`,
    upcomingLines,
    '',
    `OPEN RISKS (${openRisks?.length ?? 0}):`,
    riskLines,
    '',
    `OPEN ISSUES (${openIssues?.length ?? 0}):`,
    issueLines,
    '',
    `Write the report in ${lang}. Sections:`,
    '1. Executive Summary (2-3 sentences: overall health, RAG status, key highlights)',
    '2. Progress in Period (what was accomplished, key deliverables, quantified where possible)',
    '3. Upcoming Activities (next key activities and deadlines)',
    '4. Risks & Issues (if any: impact and current mitigation; skip if none)',
    '5. Overall Assessment: GREEN / AMBER / RED with brief justification',
    '',
    'Target: Project Sponsor / Steering Committee. Under 500 words. Direct, professional, data-driven.',
  ].filter(Boolean).join('\n');

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return NextResponse.json({ report: text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'AI generation failed' }, { status: 500 });
  }
}
