import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { createHoliday, deleteHoliday, listHolidays } from '@/lib/services/holidays.service';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listHolidays(params.id, actor)),
);

export const POST = withProjectAccess(async (_req, { params, actor, body }) => {
  const { date, name } = body as { date: string; name: string };
  return NextResponse.json(await createHoliday(params.id, actor, date, name), { status: 201 });
});

export const DELETE = withProjectAccess(async (req, { params, actor }) => {
  const hid = new URL(req.url).searchParams.get('hid');
  await deleteHoliday(params.id, actor, hid);
  return NextResponse.json({ ok: true });
});
