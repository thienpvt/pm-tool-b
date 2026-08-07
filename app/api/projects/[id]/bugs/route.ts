import { NextRequest, NextResponse } from 'next/server';
import { repoErrorResponse } from '@/lib/api-errors';
import {
  deleteAllBugs,
  deleteSnapshot,
  listBugs,
  listSnapshotDates,
  replaceSnapshot,
} from '@/lib/repositories/bugs.repo';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const url = new URL(req.url);
  try {
    // Return list of available snapshot dates
    if (url.searchParams.get('list_dates') === '1') {
      return NextResponse.json(await listSnapshotDates(id));
    }
    return NextResponse.json(await listBugs(id, url.searchParams.get('date')));
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const { bugs, snapshot_date } = await req.json();
    if (!Array.isArray(bugs)) return NextResponse.json({ error: 'bugs must be array' }, { status: 400 });

    const date = snapshot_date || new Date().toISOString().split('T')[0];
    const inserted = await replaceSnapshot(id, bugs, date);
    return NextResponse.json({ inserted, snapshot_date: date });
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const date = new URL(req.url).searchParams.get('date');
  try {
    if (date) await deleteSnapshot(id, date);
    else await deleteAllBugs(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
