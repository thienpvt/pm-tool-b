import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import {
  getPeriodTracking,
  type PeriodTrackingFilters,
} from '@/lib/services/weekly-tracking.service';

function parseTrackingFilters(searchParams: URLSearchParams): PeriodTrackingFilters {
  const filters: PeriodTrackingFilters = {};

  const status = searchParams.get('status');
  if (
    status === 'not_submitted'
    || status === 'draft'
    || status === 'submitted'
    || status === 'overdue'
  ) {
    filters.status = status;
  }

  const lateness = searchParams.get('lateness');
  if (lateness === 'on_time' || lateness === 'late') {
    filters.lateness = lateness;
  }

  const pmUserId = searchParams.get('pm_user_id');
  if (pmUserId !== null && pmUserId !== '') {
    const parsed = Number(pmUserId);
    if (!Number.isNaN(parsed)) filters.pm_user_id = parsed;
  }

  const stage = searchParams.get('stage');
  if (stage !== null && stage !== '') filters.stage = stage;

  const rag = searchParams.get('rag');
  if (rag !== null && rag !== '') filters.rag = rag;

  if (searchParams.get('technology_council') === 'true') {
    filters.technology_council = true;
  }

  return filters;
}

export const GET = withCpmo<{ periodId: string }>(async (req, { actor, params }) => {
  const { periodId: periodIdParam } = await params;
  const periodId = Number(periodIdParam);
  const filters = parseTrackingFilters(req.nextUrl.searchParams);
  return NextResponse.json(
    await getPeriodTracking(actor.company_id!, periodId, actor, filters),
  );
});
