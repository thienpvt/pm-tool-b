import { NextRequest, NextResponse } from 'next/server';
import {
  listByStatuses,
  listDoneBetween,
  listPlannedBetweenExcludingStatuses,
  listStatusAndPhase,
} from '@/lib/repositories/activities.repo';
import { listOpenIssues } from '@/lib/repositories/issues.repo';
import { getProjectWithCustomer } from '@/lib/repositories/projects.repo';
import { listOpenRisks } from '@/lib/repositories/risks.repo';
import { getSetting } from '@/lib/repositories/settings.repo';
import Anthropic from '@anthropic-ai/sdk';

type Params = { params: Promise<{ id: string }> };

type ActivityRow = { activity: string; deliverable: string; completion_pct: number; plan_start: string; plan_end: string; };
type RiskRow = { priority: string; description: string; mitigation: string; };

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

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');
  const weekStart = searchParams.get('week') ?? undefined;

  let startStr: string, endStr: string;
  if (startParam && endParam) {
    startStr = startParam;
    endStr = endParam;
  } else {
    const { start, end } = getWeekBounds(weekStart);
    startStr = fmt(start);
    endStr = fmt(end);
  }

  const project = await getProjectWithCustomer(id) as any;
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const doneThisWeek = await listDoneBetween(id, startStr, endStr, DONE_STATUSES) as any[];

  const inProgress = await listByStatuses(id, IN_PROGRESS_STATUSES) as any[];

  const endDate = new Date(endStr + 'T23:59:59');
  const nextStart = fmt(new Date(endDate.getTime() + 1));
  const nextEnd = fmt(new Date(endDate.getTime() + 7 * 86400000));
  const nextWeekPlan = await listPlannedBetweenExcludingStatuses(
    id, nextStart, nextEnd, DONE_STATUSES,
  ) as any[];

  const openRisks = await listOpenRisks(id) as any[];

  const openIssues = await listOpenIssues(id) as any[];

  // Weighted stats from all US activities
  const allActivities = await listStatusAndPhase(id);

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

  return NextResponse.json({
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
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  void id;
  const body = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY || (await getSetting('anthropic_api_key'));
  if (!apiKey) {
    return NextResponse.json(
      { error: 'NO_API_KEY' },
      { status: 503 }
    );
  }

  const { reportData, language = 'Vietnamese' } = body;
  const { project, weekRange, doneThisWeek, inProgress, nextWeekPlan, openRisks, openIssues, stats, epicStats } = reportData;
  const lang = language === 'English' ? 'English' : 'Vietnamese';

  const doneLines = doneThisWeek.length === 0
    ? '- None'
    : doneThisWeek.map((a: ActivityRow) => `- ${a.activity}${a.deliverable ? ` → ${a.deliverable}` : ''}`).join('\n');

  const inProgressLines = inProgress.length === 0
    ? '- None'
    : inProgress.map((a: ActivityRow) => `- ${a.activity} (${a.completion_pct}%)${a.plan_end ? ` due ${a.plan_end}` : ''}`).join('\n');

  const nextWeekLines = nextWeekPlan.length === 0
    ? '- None scheduled'
    : nextWeekPlan.map((a: ActivityRow) => `- ${a.activity}${a.plan_start ? ` (starts ${a.plan_start})` : ''}`).join('\n');

  const riskLines = openRisks.length === 0
    ? '- None'
    : openRisks.map((r: RiskRow) => `- [${r.priority}] ${r.description}${r.mitigation ? ` → Mitigation: ${r.mitigation}` : ''}`).join('\n');

  const issueLines = openIssues.length === 0
    ? '- None'
    : openIssues.map((r: RiskRow) => `- [${r.priority}] ${r.description}${r.mitigation ? ` → Resolution: ${r.mitigation}` : ''}`).join('\n');

  const epicLines = epicStats?.length
    ? '\nEPIC PROGRESS:\n' + epicStats.map((e: { phase: string; done: number; total: number; pct: number }) =>
        `- ${e.phase}: ${e.pct}% (${e.done}/${e.total} US done)`
      ).join('\n')
    : '';

  const prompt = [
    'You are a senior project manager. Generate a concise weekly status report for the CEO.',
    '',
    `Project: ${project.name}`,
    `Customer: ${project.customer_name || project.client || 'N/A'}`,
    `Phase: ${project.current_phase}`,
    `Report Week: ${weekRange.start} to ${weekRange.end}`,
    `Overall Progress: ${stats.completion_pct}% weighted (Done: ${stats.done}, In-Progress: ${stats.inProgress}, Not Started: ${stats.notStarted}, Total: ${stats.total} US)`,
    epicLines,
    '',
    `COMPLETED THIS WEEK (${doneThisWeek.length}):`,
    doneLines,
    '',
    `IN PROGRESS (${inProgress.length}):`,
    inProgressLines,
    '',
    `NEXT WEEK PLAN (${nextWeekPlan.length}):`,
    nextWeekLines,
    '',
    `OPEN RISKS (${openRisks.length}):`,
    riskLines,
    '',
    `OPEN ISSUES (${openIssues.length}):`,
    issueLines,
    '',
    `Write the report in ${lang}. Format:`,
    '1. Executive Summary (2-3 sentences: overall health, key achievement)',
    '2. This Week\'s Progress (bullet points, specific and results-focused)',
    '3. Next Week Plan (bullet points)',
    '4. Risks & Issues (only if there are any, be concise)',
    '5. Overall Status: GREEN / AMBER / RED with one-line justification',
    '',
    'Keep it under 350 words. Be direct, professional, CEO-appropriate. No padding or filler phrases.',
  ].join('\n');

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return NextResponse.json({ report: text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'AI generation failed' }, { status: 500 });
  }
}