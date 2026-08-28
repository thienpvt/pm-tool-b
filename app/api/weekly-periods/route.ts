import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { createWeeklyPeriod, listWeeklyPeriods } from '@/lib/services/weekly-reports.service';
import { createPeriodSchema } from './schema';

export const GET = withCpmo(async (_req, { actor }) =>
  NextResponse.json(await listWeeklyPeriods(actor)),
);

export const POST = withCpmo(
  async (_req, { actor, body }) => {
    const period = await createWeeklyPeriod(actor, body as Record<string, unknown>);
    return NextResponse.json(period, { status: 201 });
  },
  { schema: createPeriodSchema },
);
