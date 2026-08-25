import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { listProjectWeeklyHistory } from '@/lib/services/weekly-reports.service';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listProjectWeeklyHistory(params.id, actor)),
);
