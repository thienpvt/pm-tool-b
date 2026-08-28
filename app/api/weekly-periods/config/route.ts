import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import {
  getCompanyWeeklyConfig,
  upsertCompanyWeeklyConfig,
} from '@/lib/services/weekly-reports.service';
import { weeklyConfigSchema } from './schema';

export const GET = withCpmo(async (_req, { actor }) =>
  NextResponse.json(await getCompanyWeeklyConfig(actor)),
);

export const PUT = withCpmo(
  async (_req, { actor, body }) => {
    await upsertCompanyWeeklyConfig(actor, body as { due_weekday: number; due_time_utc: string });
    return NextResponse.json({ ok: true });
  },
  { schema: weeklyConfigSchema },
);
