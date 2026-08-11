import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  createActivity,
  deleteActivity,
  listActivities,
  updateActivity,
} from '@/lib/services/activities.service';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listActivities(params.id, actor)),
);

export const POST = withProjectAccess(async (_req, { params, actor, body }) =>
  NextResponse.json(await createActivity(params.id, actor, body as Record<string, unknown>), { status: 201 }),
);

export const PUT = withProjectAccess(async (_req, { params, actor, body }) => {
  const { id: rowId, ...fields } = body as Record<string, unknown>;
  return NextResponse.json(await updateActivity(params.id, actor, rowId as string | number, fields));
});

export const DELETE = withProjectAccess(async (req, { params, actor }) => {
  const rowId = new URL(req.url).searchParams.get('rowId') ?? '';
  await deleteActivity(params.id, actor, rowId);
  return NextResponse.json({ ok: true });
});
