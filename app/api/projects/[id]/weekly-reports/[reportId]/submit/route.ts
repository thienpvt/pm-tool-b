import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { submitWeeklyReport } from '@/modules/weekly/backend/services/weekly-reports.service';

export const POST = withProjectAccess<{ id: string; reportId: string }>(
  async (_req, { params, actor }) =>
    NextResponse.json(
      await submitWeeklyReport(params.id, params.reportId, actor),
      { status: 201 },
    ),
  { rawBody: true },
);
