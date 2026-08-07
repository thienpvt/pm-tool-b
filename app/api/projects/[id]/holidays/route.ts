import { NextRequest, NextResponse } from 'next/server';
import { repoErrorResponse } from '@/lib/api-errors';
import { createHoliday, deleteHoliday, findHolidayByDate, listHolidays } from '@/lib/repositories/holidays.repo';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    return NextResponse.json(await listHolidays(id));
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const { date, name } = await req.json();
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });
    // Duplicate-date guard: same 409 the inline handler returned.
    if (await findHolidayByDate(id, date)) {
      return NextResponse.json({ error: 'date already exists' }, { status: 409 });
    }
    return NextResponse.json(await createHoliday(id, date, name), { status: 201 });
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const hid = new URL(req.url).searchParams.get('hid');
  if (!hid) return NextResponse.json({ error: 'hid required' }, { status: 400 });
  try {
    await deleteHoliday(id, hid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
