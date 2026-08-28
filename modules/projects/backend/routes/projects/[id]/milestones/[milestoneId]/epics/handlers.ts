import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { linkEpic, listEpics, unlinkEpic } from '@/modules/projects/backend/services/milestones.service';
import { epicInputSchema } from './schema';
type Params = { id: string; milestoneId: string };

export async function getMilestonesMilestoneIdEpicsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await listEpics(params.id, actor, params.milestoneId)); }

export async function postMilestonesMilestoneIdEpicsHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
    const { activity_id } = body as { activity_id: string | number };
    await linkEpic(params.id, actor, params.milestoneId, activity_id);
    return NextResponse.json({ ok: true }, { status: 201 });
  },
  { schema: epicInputSchema },

export async function deleteMilestonesMilestoneIdEpicsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const activityId = new URL(req.url).searchParams.get('activity_id');
  await unlinkEpic(params.id, actor, params.milestoneId, activityId ?? '');
  return NextResponse.json({ ok: true });
}
