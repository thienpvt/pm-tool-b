import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import type { ProjectAccessRow } from '@/modules/projects/backend/repositories/projects.repo';
import { openWeeklyReportCorrection } from '@/modules/weekly/backend/services/weekly-reports.service';

export async function correctWeeklyReportHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string; reportId: string }> & { project: ProjectAccessRow },
) {
  return NextResponse.json(
    await openWeeklyReportCorrection(
      params.id,
      params.reportId,
      actor,
      (body ?? {}) as Record<string, unknown>,
    ),
  );
}
