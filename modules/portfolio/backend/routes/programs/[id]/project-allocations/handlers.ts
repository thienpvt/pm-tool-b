import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { assertCompanyWrite, assertProjectAccess } from '@/lib/services/access';
import {
  programProjectAllocations,
  upsertProgramProjectAllocation,
} from '@/modules/portfolio/backend/repositories/programs.repo';

export async function getProgramProjectAllocationsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const { program: programInfo, projects } = await programProjectAllocations(
    params.id,
    actor.company_id,
  );

  return NextResponse.json({
    program_id: Number(params.id),
    program_name: programInfo?.name ?? '',
    portfolio_allocated: programInfo?.allocated_headcount ?? 0,
    projects,
  });
}

export async function postProgramProjectAllocationHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  const { project_id, allocated_headcount } = body as {
    project_id?: number | string;
    allocated_headcount?: unknown;
  };
  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

  await assertProjectAccess(project_id, actor);
  assertCompanyWrite(actor);

  const headcount = Math.max(0, Number(allocated_headcount) || 0);
  const id = await upsertProgramProjectAllocation(params.id, project_id, headcount);
  return NextResponse.json({ id, project_id, allocated_headcount: headcount });
}
