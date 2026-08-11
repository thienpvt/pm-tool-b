import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { deleteProject, getProject, updateProject } from '@/lib/services/projects.service';

// Shape guard only — the PROJECT_COLUMNS allowlist in the repo already rejects
// unknown keys via UnknownColumnError (T-04-25). This is not a column allowlist
// duplicate, just a passthrough object-shape check.
const projectUpdateSchema = z.object({}).passthrough();

// GET intentionally calls getProject(ctx.params.id, ctx.actor) rather than
// trusting ctx.project — getProject returns the FULL project row while
// ctx.project is only the tenancy columns (ProjectAccessRow).
export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await getProject(params.id, actor)),
);

export const PATCH = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(await updateProject(params.id, actor, body as Record<string, unknown>)),
  { schema: projectUpdateSchema },
);

export const DELETE = withProjectAccess(async (_req, { params, actor }) => {
  await deleteProject(params.id, actor);
  return NextResponse.json({ ok: true });
});
