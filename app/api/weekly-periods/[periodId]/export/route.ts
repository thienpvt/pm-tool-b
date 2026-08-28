import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { exportConsolidatedWeekly } from '@/lib/services/weekly-tracking.service';

function parsePeriodIdParam(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}
import { periodExportSchema } from './schema';

export const POST = withCpmo<{ periodId: string }>(
  async (_req, { actor, params, body }) => {
    const { periodId: periodIdParam } = await params;
    const periodId = parsePeriodIdParam(periodIdParam);
    if (periodId === null) {
      return NextResponse.json({ error: 'Invalid periodId' }, { status: 400 });
    }
    const result = await exportConsolidatedWeekly(
      actor.company_id!,
      periodId,
      actor,
      body as { project_ids: number[]; format: 'xlsx' | 'docx' | 'pptx' },
    );
    return new NextResponse(result.buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    });
  },
  { schema: periodExportSchema },
);
