import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { resolveAnthropicCredentials } from '@/lib/integrations/credentials';
import { createMessage } from '@/lib/integrations/anthropic/client';
import { MODEL_OPUS_4_7 } from '@/lib/integrations/anthropic/models';
import { integrationErrorResponse, serviceErrorResponse } from '@/lib/api-errors';
import { IntegrationError } from '@/lib/integrations/errors';
import { isCpmo, toAccessActor } from '@/lib/services/access';
import { getPortfolioReport } from '@/modules/reports/backend/services/portfolio-report.service';

// ─── GET: Full portfolio report data ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const data = await getPortfolioReport(
      toAccessActor(user),
      {
        start: searchParams.get('start'),
        end: searchParams.get('end'),
        milestone_ids: searchParams.get('milestone_ids'),
      },
    );
    return NextResponse.json(data);
  } catch (e) {
    // Phase 3 freeze: IntegrationError re-thrown untouched by services must keep
    // the Anthropic 500/502 status split. Service errors map separately.
    if (e instanceof IntegrationError) return integrationErrorResponse(e);
    return serviceErrorResponse(e);
  }
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
  // HYG-03 (06-06): POST had no session check — the sibling GET and the
  // generate-email/send-email routes in this same tree all gate on
  // getSessionFromRequest; this endpoint silently didn't. Anonymous callers
  // could burn the shared Anthropic key generating full portfolio reports.
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const actor = toAccessActor(user);
  if (!isCpmo(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
