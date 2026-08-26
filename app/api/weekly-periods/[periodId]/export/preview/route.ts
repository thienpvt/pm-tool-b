import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { previewConsolidatedExport } from '@/lib/services/weekly-tracking.service';
import { periodExportPreviewSchema } from './schema';

export const POST = withCpmo<{ periodId: string }>(
  async (_req, { actor, params, body }) => {
    const { periodId: periodIdParam } = await params;
    const periodId = Number(periodIdParam);
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
