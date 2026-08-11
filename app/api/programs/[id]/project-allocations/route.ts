import { NextResponse } from 'next/server';
import { withProgramAccess } from '@/lib/http/with-program-access';
import { assertProjectAccess } from '@/lib/services/access';
import {
  programProjectAllocations,
  upsertProgramProjectAllocation,
} from '@/lib/repositories/programs.repo';

// GET: all projects in this program with their allocated headcount from this program.
// withProgramAccess asserts ownership of the program (ctx.params.id) before this runs —
// closes the T-04-22-adjacent read leak (program info query is not company-scoped by itself).
export const GET = withProgramAccess(async (_req, { params, actor }) => {
  const { program: programInfo, projects } = await programProjectAllocations(
    params.id, actor.company_id, Boolean(actor.is_admin),
  );

  return NextResponse.json({
    program_id: Number(params.id),
    program_name: programInfo?.name ?? '',
    portfolio_allocated: programInfo?.allocated_headcount ?? 0,
    projects,
  });
});

// POST: upsert allocation from program to project.
// withProgramAccess asserts the PROGRAM (ctx.params.id). The body's project_id is a
// separate resource no wrapper can reach — assertProjectAccess on it MUST stay inline.
// This is the T-04-22 two-sided write IDOR fix (both program and project must be owned).
export const POST = withProgramAccess(async (_req, { params, actor, body }) => {
  const { project_id, allocated_headcount } = body as {
    project_id?: number | string;
    allocated_headcount?: unknown;
  };
  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

  await assertProjectAccess(project_id, actor);

  const headcount = Math.max(0, Number(allocated_headcount) || 0);
  const id = await upsertProgramProjectAllocation(params.id, project_id, headcount);
  return NextResponse.json({ id, project_id, allocated_headcount: headcount });
});
