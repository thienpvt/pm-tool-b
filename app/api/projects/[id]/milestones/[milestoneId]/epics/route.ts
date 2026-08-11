import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { linkEpic, listEpics, unlinkEpic } from '@/lib/services/milestones.service';

type Params = { id: string; milestoneId: string };

export const GET = withProjectAccess<Params>(async (_req, { params, actor }) =>
  NextResponse.json(await listEpics(params.id, actor, params.milestoneId)),
);

export const POST = withProjectAccess<Params>(async (_req, { params, actor, body }) => {
  const { activity_id } = body as { activity_id: string | number };
  await linkEpic(params.id, actor, params.milestoneId, activity_id);
  return NextResponse.json({ ok: true }, { status: 201 });
});

export const DELETE = withProjectAccess<Params>(async (req, { params, actor }) => {
  const activityId = new URL(req.url).searchParams.get('activity_id');
  await unlinkEpic(params.id, actor, params.milestoneId, activityId ?? '');
  return NextResponse.json({ ok: true });
});
