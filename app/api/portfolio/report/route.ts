import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

// ─── GET: Full portfolio report data ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const { searchParams } = new URL(req.url);

  // Date range for "completed in period" section (defaults to this Monday → Sunday)
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startParam = searchParams.get('start') ?? monday.toISOString().slice(0, 10);
  const endParam   = searchParams.get('end')   ?? sunday.toISOString().slice(0, 10);

  // Company scoping: admin sees all, regular user sees only their company
  const cc = user.is_admin ? '' : 'AND p.company_id = ?';
  const cp = user.is_admin ? [] : [user.company_id];

  const projects = await db.all(`
    SELECT p.*, c.name as customer_name, c.industry as customer_industry
    FROM projects p
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE 1=1 ${cc}
    ORDER BY p.created_at DESC
  `, ...cp) as any[];

  const customers = user.is_admin
    ? await db.all('SELECT * FROM customers ORDER BY name') as any[]
    : await db.all('SELECT * FROM customers WHERE company_id = ? ORDER BY name', user.company_id) as any[];

  const riskCounts = await db.all(`SELECT project_id, COUNT(*) as total, SUM(CASE WHEN status='Open' OR status='In Progress' THEN 1 ELSE 0 END) as open FROM risks GROUP BY project_id`) as any[];
  const issueCounts = await db.all(`SELECT project_id, COUNT(*) as total, SUM(CASE WHEN status='Open' OR status='In Progress' THEN 1 ELSE 0 END) as open FROM issues GROUP BY project_id`) as any[];
  const activityStats = await db.all(`SELECT project_id, COUNT(*) as total, AVG(completion_pct) as avg_pct, SUM(CASE WHEN status='Done' THEN 1 ELSE 0 END) as done FROM activities GROUP BY project_id`) as any[];

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

  const byCustomer = customers.map((c: any) => ({
    ...c,
    projects: enrichedProjects.filter((p: any) => p.customer_id === c.id),
  }));
  const noCustomer = enrichedProjects.filter((p: any) => !p.customer_id);

  const phases = ['Initiation', 'Planning', 'Execution', 'Closing'];
  const phaseDist = phases.map(phase => ({
    phase,
    count: projects.filter((p: any) => p.current_phase === phase).length,
  }));

  const customerBar = byCustomer.map((c: any) => ({
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
    SELECT r.*, p.name as project_name, c.name as customer_name
    FROM risks r
    JOIN projects p ON r.project_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE (r.status='Open' OR r.status='In Progress') ${cc}
    ORDER BY CASE r.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, r.id DESC
    LIMIT 12
  `, ...cp) as any[];

  const topIssues = await db.all(`
    SELECT i.*, p.name as project_name, c.name as customer_name
    FROM issues i
    JOIN projects p ON i.project_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE (i.status='Open' OR i.status='In Progress') ${cc}
    ORDER BY CASE i.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, i.id DESC
    LIMIT 12
  `, ...cp) as any[];

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const plus30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const minus14 = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);

  const upcomingMilestones = await db.all(`
    SELECT a.*, p.name as project_name, c.name as customer_name
    FROM activities a
    JOIN projects p ON a.project_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE a.plan_end BETWEEN ? AND ?
      AND a.status != 'Done' ${cc}
    ORDER BY a.plan_end ASC
    LIMIT 15
  `, todayStr, plus30, ...cp) as any[];

  const recentlyCompleted = await db.all(`
    SELECT a.*, p.name as project_name, c.name as customer_name
    FROM activities a
    JOIN projects p ON a.project_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE a.status = 'Done'
      AND a.actual_end >= ? ${cc}
    ORDER BY a.actual_end DESC
    LIMIT 10
  `, minus14, ...cp) as any[];

  // ─── Completed activities in selected date range, grouped by project ─────────
  const completedInRange = await db.all(`
    SELECT a.*, p.name as project_name, p.current_phase, c.name as customer_name
    FROM activities a
    JOIN projects p ON a.project_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE a.status = 'Done'
      AND a.actual_end >= ?
      AND a.actual_end <= ? ${cc}
    ORDER BY a.project_id, a.actual_end
  `, startParam, endParam, ...cp) as any[];

  // Group by project_id
  const completedByProject: Record<number, { project_name: string; customer_name: string; current_phase: string; activities: any[] }> = {};
  for (const act of completedInRange) {
    if (!completedByProject[act.project_id]) {
      completedByProject[act.project_id] = {
        project_name: act.project_name,
        customer_name: act.customer_name ?? '',
        current_phase: act.current_phase,
        activities: [],
      };
    }
    completedByProject[act.project_id].activities.push(act);
  }

  return NextResponse.json({
    projects: enrichedProjects,
    customers: byCustomer,
    noCustomerProjects: noCustomer,
    phaseDist,
    customerBar,
    kpi: {
      totalProjects: projects.length,
      totalCustomers: customers.length,
      totalOpenRisks,
      totalOpenIssues,
      avgCompletion,
      activeProjects: projects.filter((p: any) => p.current_phase !== 'Closing').length,
    },
    topRisks,
    topIssues,
    upcomingMilestones,
    recentlyCompleted,
    completedByProject,
    periodStart: startParam,
    periodEnd: endParam,
    reportDate: todayStr,
  });
}

// ─── POST: AI report generation ───────────────────────────────────────────────
type ProjectSummary = {
  name: string; customer_name: string; current_phase: string;
  completion_pct: number; open_risks: number; open_issues: number;
  days_until_deadline: number | null; rag: 'red' | 'amber' | 'green';
  pm_name: string;
};
type CustomerGroup = { name: string; industry: string; projects: ProjectSummary[]; };
type RiskSummary = { priority: string; description: string; project_name: string; customer_name: string; };
type MilestoneSummary = { plan_end: string; activity: string; project_name: string; };
type CompletedActivity = { activity: string; deliverable?: string; actual_end?: string; };
type CompletedGroup = { project_name: string; customer_name: string; activities: CompletedActivity[]; };
type PortfolioPayload = {
  reportDate: string;
  periodStart?: string;
  periodEnd?: string;
  kpi: { totalProjects: number; totalCustomers: number; avgCompletion: number; activeProjects: number; totalOpenRisks: number; totalOpenIssues: number; };
  customers: CustomerGroup[];
  noCustomerProjects: ProjectSummary[];
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

  const { kpi, customers, noCustomerProjects, reportDate, topRisks, topIssues, upcomingMilestones, completedByProject, periodStart, periodEnd } = portfolioData;
  const allProjects = [...customers.flatMap(c => c.projects), ...noCustomerProjects];
  const redProjects = allProjects.filter(p => p.rag === 'red');
  const amberProjects = allProjects.filter(p => p.rag === 'amber');
  const greenProjects = allProjects.filter(p => p.rag === 'green');

  const customerLines = customers.map(c => {
    const lines = [`${c.name}${c.industry ? ` (${c.industry})` : ''} — ${c.projects.length} project(s):`];
    c.projects.forEach(p => {
      const deadline = p.days_until_deadline === null ? '' : p.days_until_deadline < 0 ? ` OVERDUE ${Math.abs(p.days_until_deadline)}d` : ` ${p.days_until_deadline}d left`;
      lines.push(`  - [${p.rag.toUpperCase()}] ${p.name} | ${p.current_phase} | ${p.completion_pct}% | risks:${p.open_risks} issues:${p.open_issues}${deadline}`);
    });
    return lines.join('\n');
  }).join('\n\n');

  const redLines = redProjects.length === 0 ? '- None' : redProjects.map(p => {
    const dl = p.days_until_deadline;
    return `- ${p.name} (${p.customer_name || 'N/A'}) — ${p.completion_pct}%${dl !== null && dl < 0 ? ` | OVERDUE ${Math.abs(dl)} days` : dl !== null ? ` | Due in ${dl} days` : ''} | ${p.open_risks} risks, ${p.open_issues} issues`;
  }).join('\n');

  const riskLines = topRisks && topRisks.length > 0
    ? topRisks.slice(0, 8).map(r => `- [${r.priority}] ${r.description} — ${r.project_name} (${r.customer_name || 'N/A'})`).join('\n')
    : '- None';

  const issueLines = topIssues && topIssues.length > 0
    ? topIssues.slice(0, 8).map(i => `- [${i.priority}] ${i.description} — ${i.project_name} (${i.customer_name || 'N/A'})`).join('\n')
    : '- None';

  const milestoneLines = upcomingMilestones && upcomingMilestones.length > 0
    ? upcomingMilestones.slice(0, 10).map(m => `- ${m.plan_end} | ${m.activity} | ${m.project_name}`).join('\n')
    : '- None';

  const periodLabel = periodStart && periodEnd ? `${periodStart} → ${periodEnd}` : '';
  const completedLines = completedByProject && Object.keys(completedByProject).length > 0
    ? Object.values(completedByProject).map(g => {
        const actLines = g.activities.slice(0, 5).map(a => `    • ${a.activity}${a.deliverable ? ` → ${a.deliverable}` : ''}${a.actual_end ? ` (${a.actual_end})` : ''}`).join('\n');
        return `  ${g.project_name}${g.customer_name ? ` (${g.customer_name})` : ''}:\n${actLines}`;
      }).join('\n\n')
    : '  (No completed activities in the selected period)';

  const prompt = [
    `You are a senior PMO director at CharterTech Global. Write a comprehensive, CEO-appropriate portfolio status report.`,
    '',
    `Report Date: ${reportDate}`,
    periodLabel ? `Reporting Period: ${periodLabel}` : '',
    `Total Projects: ${kpi.totalProjects} across ${kpi.totalCustomers} customers`,
    `Active: ${kpi.activeProjects} | Avg Completion: ${kpi.avgCompletion}%`,
    `Portfolio Health: ${redProjects.length} RED, ${amberProjects.length} AMBER, ${greenProjects.length} GREEN`,
    `Total Open Risks: ${kpi.totalOpenRisks} | Total Open Issues: ${kpi.totalOpenIssues}`,
    '',
    'PROJECTS BY CUSTOMER:',
    customerLines,
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
    'VI. Customer Scorecard (one paragraph per customer: their project health, progress, concerns)',
    'VII. Recommended Actions (3-5 concrete CEO/steering committee decisions or escalations required)',
    '',
    'Target length: 700-900 words total. CEO-appropriate: direct, data-driven, action-oriented.',
    'Use professional PMO language. No filler phrases. Be specific with numbers and deadlines.',
    'For each RED project, explicitly recommend a specific action (escalation, resource injection, scope change, etc.).',
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
