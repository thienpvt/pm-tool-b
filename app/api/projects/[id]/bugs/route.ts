import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  deleteBugs,
  listBugs,
  listSnapshotDates,
  replaceSnapshot,
} from '@/modules/projects/backend/services/bugs.service';
import { bugsInputSchema } from './schema';

export const GET = withProjectAccess(async (req, { params, actor }) => {
  const url = new URL(req.url);
  if (url.searchParams.get('list_dates') === '1') {
    return NextResponse.json(await listSnapshotDates(params.id, actor));
  }
  return NextResponse.json(await listBugs(params.id, actor, url.searchParams.get('date')));
});

export const POST = withProjectAccess(
  async (_req, { params, actor, body }) => {
    const { bugs, snapshot_date } = body as { bugs: unknown; snapshot_date: string };
    return NextResponse.json(await replaceSnapshot(params.id, actor, bugs, snapshot_date));
  },
  { schema: bugsInputSchema },
);

export const DELETE = withProjectAccess(async (req, { params, actor }) => {
  const date = new URL(req.url).searchParams.get('date');
  return NextResponse.json(await deleteBugs(params.id, actor, date));
});
