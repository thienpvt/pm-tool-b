import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { cancelMilestone, updateMilestone } from '@/modules/projects/backend/services/milestones.service';
import { milestoneUpdateSchema } from '../schema';

type Params = { id: string; milestoneId: string };

export const PUT = withProjectAccess<Params>(
  async (_req, { params, actor, body }) =>
    NextResponse.json(
      await updateMilestone(params.id, actor, params.milestoneId, body as Record<string, unknown>),
    ),
  { schema: milestoneUpdateSchema },
);

export const DELETE = withProjectAccess<Params>(async (_req, { params, actor }) => {
  await cancelMilestone(params.id, actor, params.milestoneId);
  return NextResponse.json({ ok: true });
});
