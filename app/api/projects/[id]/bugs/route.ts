import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import {
  deleteBugs,
  listBugs,
  listSnapshotDates,
  replaceSnapshot,
} from '@/lib/services/bugs.service';

type Params = { params: Promise<{ id: string }> };

function actorOf(user: { company_id: number | null; is_admin: number }) {
  return { company_id: user.company_id, is_admin: user.is_admin };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  try {
    if (url.searchParams.get('list_dates') === '1') {
      return NextResponse.json(await listSnapshotDates(id, actorOf(user)));
    }
    return NextResponse.json(await listBugs(id, actorOf(user), url.searchParams.get('date')));
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { bugs, snapshot_date } = await req.json();
    return NextResponse.json(await replaceSnapshot(id, actorOf(user), bugs, snapshot_date));
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const date = new URL(req.url).searchParams.get('date');
  try {
    return NextResponse.json(await deleteBugs(id, actorOf(user), date));
  } catch (e) {
    return serviceErrorResponse(e);
  }
}
