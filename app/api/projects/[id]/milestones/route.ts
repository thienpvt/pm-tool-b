import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { createMilestone, listMilestones } from '@/modules/projects/backend/services/milestones.service';
import { milestoneInputSchema } from './schema';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listMilestones(params.id, actor)),
);

export const POST = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(await createMilestone(params.id, actor, body as Record<string, unknown>), { status: 201 }),
  { schema: milestoneInputSchema },
);
