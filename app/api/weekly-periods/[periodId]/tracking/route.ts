import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import {
  getPeriodTracking,
  type PeriodTrackingFilters,
} from '@/lib/services/weekly-tracking.service';

export const GET = withCpmo<{ periodId: string }>(async (req, { actor, params }) => {
  const { periodId: periodIdParam } = await params;
  const periodId = Number(periodIdParam);
  return NextResponse.json(
    await getPeriodTracking(actor.company_id!, periodId, actor, {}),
  );
});
