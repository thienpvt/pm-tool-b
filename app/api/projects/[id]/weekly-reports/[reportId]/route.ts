import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  getWeeklyReportShell,
  saveWeeklyReportDraft,
} from '@/lib/services/weekly-reports.service';
import { weeklyReportDraftSchema } from './schema';

export const GET = withProjectAccess<{ id: string; reportId: string }>(
  async (_req, { params, actor }) =>
    NextResponse.json(
      await getWeeklyReportShell(params.id, actor, params.reportId),
    ),
);

export const PATCH = withProjectAccess<{ id: string; reportId: string }>(
  async (_req, { params, actor, body }) =>
    NextResponse.json(
      await saveWeeklyReportDraft(
        params.id,
        params.reportId,
        actor,
        body as Record<string, unknown>,
      ),
    ),
  { schema: weeklyReportDraftSchema },
);
