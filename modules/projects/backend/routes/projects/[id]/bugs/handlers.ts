import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import {
  deleteBugs,
  listBugs,
  listSnapshotDates,
  replaceSnapshot,
} from '@/modules/projects/backend/services/bugs.service';

export async function getBugsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const url = new URL(_req.url);
  if (url.searchParams.get('list_dates') === '1') {
    return NextResponse.json(await listSnapshotDates(params.id, actor));
  }
  return NextResponse.json(await listBugs(params.id, actor, url.searchParams.get('date')));
}

export async function postBugsHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  const { bugs, snapshot_date } = body as { bugs: unknown; snapshot_date: string };
  return NextResponse.json(await replaceSnapshot(params.id, actor, bugs, snapshot_date));
}

export async function deleteBugsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const date = new URL(_req.url).searchParams.get('date');
  return NextResponse.json(await deleteBugs(params.id, actor, date));
}
