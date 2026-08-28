import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { openWeeklyReportCorrection } from '@/lib/services/weekly-reports.service';
import { weeklyReportCorrectionSchema } from '../schema';

export const POST = withProjectAccess<{ id: string; reportId: string }>(
  async (_req, { params, actor, body }) =>
    NextResponse.json(
      await openWeeklyReportCorrection(
        params.id,
        params.reportId,
        actor,
        (body ?? {}) as Record<string, unknown>,
      ),
    ),
  { schema: weeklyReportCorrectionSchema },
);
