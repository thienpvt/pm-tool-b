import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { createHoliday, deleteHoliday, listHolidays } from '@/modules/projects/backend/services/holidays.service';
import { holidayInputSchema } from './schema';

export async function getHolidaysHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await listHolidays(params.id, actor)); }

export async function postHolidaysHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
    const { date, name } = body as { date: string; name: string };
    return NextResponse.json(await createHoliday(params.id, actor, date, name), { status: 201 });
  },
  { schema: holidayInputSchema },

export async function deleteHolidaysHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const hid = new URL(req.url).searchParams.get('hid');
  await deleteHoliday(params.id, actor, hid);
  return NextResponse.json({ ok: true });
}
