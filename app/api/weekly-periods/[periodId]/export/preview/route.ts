import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { previewConsolidatedExport } from '@/lib/services/weekly-tracking.service';

function parsePeriodIdParam(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}
import { periodExportPreviewSchema } from './schema';

export const POST = withCpmo<{ periodId: string }>(
  async (_req, { actor, params, body }) => {
    const { periodId: periodIdParam } = await params;
    const periodId = parsePeriodIdParam(periodIdParam);
    if (periodId === null) {
      return NextResponse.json({ error: 'Invalid periodId' }, { status: 400 });
    }
    return NextResponse.json(
      await previewConsolidatedExport(
        actor.company_id!,
        periodId,
        actor,
        (body as { project_ids: number[] }).project_ids,
      ),
    );
  },
  { schema: periodExportPreviewSchema },
);
