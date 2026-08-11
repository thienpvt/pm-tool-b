import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { deleteProject, getProject, updateProject } from '@/lib/services/projects.service';

// GET intentionally calls getProject(ctx.params.id, ctx.actor) rather than
// trusting ctx.project — getProject returns the FULL project row while
// ctx.project is only the tenancy columns (ProjectAccessRow).
export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await getProject(params.id, actor)),
);

export const PATCH = withProjectAccess(async (_req, { params, actor, body }) =>
  NextResponse.json(await updateProject(params.id, actor, body as Record<string, unknown>)),
);

export const DELETE = withProjectAccess(async (_req, { params, actor }) => {
  await deleteProject(params.id, actor);
  return NextResponse.json({ ok: true });
});
