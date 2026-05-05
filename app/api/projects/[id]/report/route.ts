import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

type Params = { params: Promise<{ id: string }> };

type ActivityRow = { activity: string; deliverable: string; completion_pct: number; plan_start: string; plan_end: string; };
type RiskRow = { priority: string; description: string; mitigation: string; };

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

  const db = await getDb();
  let startStr: string, endStr: string;
  if (startParam && endParam) {
    startStr = startParam;
    endStr = endParam;
  } else {
    const { start, end } = getWeekBounds(weekStart);
    startStr = fmt(start);
    endStr = fmt(end);
  }

  const project = await db.get(`
    SELECT p.*, c.name as customer_name
    FROM projects p LEFT JOIN customers c ON p.customer_id = c.id
    WHERE p.id = ?
  `, id) as any;
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const doneThisWeek = await db.all(
    `SELECT * FROM activities WHERE project_id = ?
     AND actual_end >= ? AND actual_end <= ? AND status = 'Done'
     ORDER BY actual_end`,
    id, startStr, endStr
  ) as any[];

  const inProgress = await db.all(
    `SELECT * FROM activities WHERE project_id = ? AND status = 'In Progress' ORDER BY plan_end`,
    id
  ) as any[];

  const endDate = new Date(endStr + 'T23:59:59');
  const nextStart = fmt(new Date(endDate.getTime() + 1));
  const nextEnd = fmt(new Date(endDate.getTime() + 7 * 86400000));
  const nextWeekPlan = await db.all(
    `SELECT * FROM activities WHERE project_id = ?
     AND plan_start >= ? AND plan_start <= ? AND status != 'Done'
     ORDER BY plan_start`,
    id, nextStart, nextEnd
  ) as any[];

  const openRisks = await db.all(
    `SELECT * FROM risks WHERE project_id = ? AND (status='Open' OR status='In Progress') ORDER BY priority`,
    id
  ) as any[];

  const openIssues = await db.all(
    `SELECT * FROM issues WHERE project_id = ? AND (status='Open' OR status='In Progress') ORDER BY priority`,
    id
  ) as any[];

  const stats = await db.get(
    `SELECT COUNT(*) as total, SUM(CASE WHEN status='Done' THEN 1 ELSE 0 END) as done, AVG(completion_pct) as avg_pct
     FROM activities WHERE project_id = ?`,
    id
  ) as any;

  return NextResponse.json({
    project,
    weekRange: { start: startStr, end: endStr },
    doneThisWeek,
    inProgress,
    nextWeekPlan,
    openRisks,
    openIssues,
    stats: {
      total: stats.total ?? 0,
      done: stats.done ?? 0,
      completion_pct: Math.round(stats.avg_pct ?? 0),
    },
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  void id;
  const body = await req.json();

  const db2 = await getDb();
  const dbKey = (await db2.get("SELECT value FROM settings WHERE key='anthropic_api_key'") as any)?.value;
  const apiKey = process.env.ANTHROPIC_API_KEY || dbKey;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'NO_API_KEY' },
      { status: 503 }
    );
  }

  const { reportData, language = 'Vietnamese' } = body;
  const { project, weekRange, doneThisWeek, inProgress, nextWeekPlan, openRisks, openIssues, stats } = reportData;
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

  const prompt = [
    'You are a senior project manager at CharterTech Global. Generate a concise weekly status report for the CEO.',
    '',
    `Project: ${project.name}`,
    `Customer: ${project.customer_name || project.client || 'N/A'}`,
    `Phase: ${project.current_phase}`,
    `Report Week: ${weekRange.start} to ${weekRange.end}`,
    `Overall Progress: ${stats.completion_pct}% (${stats.done}/${stats.total} activities done)`,
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
