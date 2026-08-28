/* eslint-disable @typescript-eslint/no-explicit-any -- POST body typing preserved from pre-extraction route */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { resolveAnthropicCredentials } from '@/lib/integrations/credentials';
import { createMessage } from '@/lib/integrations/anthropic/client';
import { MODEL_OPUS_4_7 } from '@/lib/integrations/anthropic/models';
import { integrationErrorResponse, serviceErrorResponse } from '@/lib/api-errors';
import { IntegrationError } from '@/lib/integrations/errors';
import { assertProjectWriteAccess } from '@/lib/services/access';
import { getWeeklyProjectReport } from '@/modules/reports/backend/services/project-report.service';

type ActivityRow = { activity: string; deliverable: string; completion_pct: number; plan_start: string; plan_end: string; };
type RiskRow = { priority: string; description: string; mitigation: string; };

export async function getWeeklyReportHandler(
  req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const { searchParams } = new URL(req.url);

  try {
    const data = await getWeeklyProjectReport(
      params.id,
      actor,
      {
        start: searchParams.get('start'),
        end: searchParams.get('end'),
        week: searchParams.get('week'),
      },
    );
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof IntegrationError) return integrationErrorResponse(e);
    return serviceErrorResponse(e);
  }
}

export async function postWeeklyReportHandler(
  req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  await assertProjectWriteAccess(params.id, actor);

  // WR-05: reject a malformed/oversized body with a JSON 400 instead of letting
  // req.json() reject the handler and surface a bare 500.
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const creds = await resolveAnthropicCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: 'NO_API_KEY' },
      { status: 503 },
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
        `- ${e.phase}: ${e.pct}% (${e.done}/${e.total} US done)`,
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
    const { text } = await createMessage(creds, {
      model: MODEL_OPUS_4_7,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    return NextResponse.json({ report: text });
  } catch (e) {
    // Behavior change: adds a 120s SDK timeout where none existed (HYG-02)
    return integrationErrorResponse(e, { force500: true });
  }
}
