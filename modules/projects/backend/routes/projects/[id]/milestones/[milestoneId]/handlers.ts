import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { cancelMilestone, updateMilestone } from '@/modules/projects/backend/services/milestones.service';
import { milestoneUpdateSchema } from '../schema';
type Params = { id: string; milestoneId: string };

export async function putMilestonesMilestoneIdHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) { return NextResponse.json(
      await updateMilestone(params.id, actor, params.milestoneId, body as Record<string, unknown>),
    ); }

export async function deleteMilestonesMilestoneIdHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  await cancelMilestone(params.id, actor, params.milestoneId);
  return NextResponse.json({ ok: true });
}
