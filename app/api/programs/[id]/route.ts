import { NextResponse } from 'next/server';
import { withProgramAccess } from '@/lib/http/with-program-access';
import { deleteProgram, getProgramDetail, updateProgram } from '@/lib/services/programs.service';

// GET/PUT/DELETE all re-call the service, which re-runs assertProgramAccess
// internally (defense in depth, matches the projects tree) — the wrapper's
// assert is the route-level gate; ctx.program is unused here for the same
// reason projects/[id]/route.ts skips ctx.project on GET.
export const GET = withProgramAccess(async (_req, { params, actor }) =>
  NextResponse.json(await getProgramDetail(params.id, actor)),
);

export const PUT = withProgramAccess(async (_req, { params, actor, body }) =>
  NextResponse.json(await updateProgram(params.id, actor, body as Record<string, unknown>)),
);

export const DELETE = withProgramAccess(async (_req, { params, actor }) =>
  NextResponse.json(await deleteProgram(params.id, actor)),
);
