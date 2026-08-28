import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import type { ProjectAccessRow } from '@/lib/repositories/projects.repo';
import { submitWeeklyReport } from '@/modules/weekly/backend/services/weekly-reports.service';

export async function submitWeeklyReportHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string; reportId: string }> & { project: ProjectAccessRow },
) {
  return NextResponse.json(
    await submitWeeklyReport(params.id, params.reportId, actor),
    { status: 201 },
  );
}
