import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import type { ProjectAccessRow } from '@/modules/projects/backend/repositories/projects.repo';
import { listProjectWeeklyHistory } from '@/modules/weekly/backend/services/weekly-reports.service';

export async function getProjectWeeklyReportsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }> & { project: ProjectAccessRow },
) {
  return NextResponse.json(await listProjectWeeklyHistory(params.id, actor));
}
