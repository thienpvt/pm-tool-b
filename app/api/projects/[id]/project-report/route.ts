/* eslint-disable @typescript-eslint/no-explicit-any -- POST body typing preserved from pre-extraction route */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { resolveAnthropicCredentials } from '@/lib/integrations/credentials';
import { createMessage } from '@/lib/integrations/anthropic/client';
import { MODEL_OPUS_4_7 } from '@/lib/integrations/anthropic/models';
import { integrationErrorResponse, serviceErrorResponse } from '@/lib/api-errors';
import { IntegrationError } from '@/lib/integrations/errors';
import { getProjectReport } from '@/lib/services/project-report.service';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);

  try {
    const data = await getProjectReport(
      id,
      { company_id: user.company_id, is_admin: user.is_admin },
      {
        start: searchParams.get('start'),
        end: searchParams.get('end'),
        milestone_id: searchParams.get('milestone_id'),
      },
    );
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof IntegrationError) return integrationErrorResponse(e);
    return serviceErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  void id;

  const creds = await resolveAnthropicCredentials();
  if (!creds) return NextResponse.json({ error: 'NO_API_KEY' }, { status: 503 });

  // WR-05: reject a malformed/oversized body with a JSON 400 instead of letting
  // req.json() reject the handler and surface a bare 500.
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
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
    const { text } = await createMessage(creds, {
      model: MODEL_OPUS_4_7,
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });
    return NextResponse.json({ report: text });
  } catch (e) {
    // Behavior change: adds a 120s SDK timeout where none existed (HYG-02)
    return integrationErrorResponse(e, { force500: true });
  }
}
