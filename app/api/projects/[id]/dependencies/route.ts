import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  createProjectDependency,
  endProjectDependency,
  listProjectDependenciesForProject,
} from '@/modules/projects/backend/services/project-dependencies.service';
import { dependencyCreateSchema, dependencyEndSchema } from './schema';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listProjectDependenciesForProject(params.id, actor)),
);

export const POST = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(
      await createProjectDependency(params.id, actor, body as Record<string, unknown>),
      { status: 201 },
    ),
  { schema: dependencyCreateSchema },
);

export const PATCH = withProjectAccess(
  async (_req, { params, actor, body }) => {
    const payload = body as Record<string, unknown>;
    const dependencyId = payload.id;
    if (dependencyId === undefined || dependencyId === null || dependencyId === '') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    return NextResponse.json(
      await endProjectDependency(params.id, actor, dependencyId, payload),
    );
  },
  { schema: dependencyEndSchema },
);
