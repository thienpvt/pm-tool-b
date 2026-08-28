import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import {
import { bugsInputSchema } from './schema';

export async function getBugsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const url = new URL(req.url);
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
  },
  { schema: bugsInputSchema },

export async function deleteBugsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const date = new URL(req.url).searchParams.get('date');
  return NextResponse.json(await deleteBugs(params.id, actor, date));
}
