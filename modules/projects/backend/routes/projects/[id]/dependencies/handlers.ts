import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import {
  createProjectDependency,
  endProjectDependency,
  listProjectDependenciesForProject,
} from '@/modules/projects/backend/services/project-dependencies.service';

export async function getDependenciesHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  return NextResponse.json(await listProjectDependenciesForProject(params.id, actor));
}

export async function postDependenciesHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  return NextResponse.json(
    await createProjectDependency(params.id, actor, body as Record<string, unknown>),
    { status: 201 },
  );
}

export async function patchDependenciesHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  const payload = body as Record<string, unknown>;
  const dependencyId = payload.id;
  if (dependencyId === undefined || dependencyId === null || dependencyId === '') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }
  return NextResponse.json(
    await endProjectDependency(params.id, actor, dependencyId, payload),
  );
}
