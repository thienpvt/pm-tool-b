import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { createMilestone, listMilestones } from '@/modules/projects/backend/services/milestones.service';
import { milestoneInputSchema } from './schema';

export async function getMilestonesHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await listMilestones(params.id, actor)); }

export async function postMilestonesHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await createMilestone(params.id, actor, body as Record<string, unknown>), { status: 201 }); }
