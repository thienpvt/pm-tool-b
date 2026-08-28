import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import type { ProjectAccessRow } from '@/modules/projects/backend/repositories/projects.repo';
import {
  getWeeklyReportShell,
  saveWeeklyReportDraft,
} from '@/modules/weekly/backend/services/weekly-reports.service';

export async function getWeeklyReportHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string; reportId: string }> & { project: ProjectAccessRow },
) {
  return NextResponse.json(
    await getWeeklyReportShell(params.id, actor, params.reportId),
  );
}

export async function patchWeeklyReportHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string; reportId: string }> & { project: ProjectAccessRow },
) {
  return NextResponse.json(
    await saveWeeklyReportDraft(
      params.id,
      params.reportId,
      actor,
      body as Record<string, unknown>,
    ),
  );
}
