import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { createHoliday, deleteHoliday, listHolidays } from '@/lib/services/holidays.service';

type Params = { params: Promise<{ id: string }> };

function actorOf(user: { company_id: number | null; is_admin: number }) {
  return { company_id: user.company_id, is_admin: user.is_admin };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await listHolidays(id, actorOf(user)));
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { date, name } = await req.json();
    return NextResponse.json(await createHoliday(id, actorOf(user), date, name), { status: 201 });
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const hid = new URL(req.url).searchParams.get('hid');
  try {
    await deleteHoliday(id, actorOf(user), hid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serviceErrorResponse(e);
  }
}
