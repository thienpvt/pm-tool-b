import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  createProjectStakeholder,
  endProjectStakeholder,
  listProjectStakeholders,
} from '@/modules/projects/backend/services/stakeholders.service';
import { stakeholderCreateSchema, stakeholderEndSchema } from './schema';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listProjectStakeholders(params.id, actor)),
);

export const POST = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(
      await createProjectStakeholder(params.id, actor, body as Record<string, unknown>),
      { status: 201 },
    ),
  { schema: stakeholderCreateSchema },
);

export const PATCH = withProjectAccess(
  async (_req, { params, actor, body }) => {
    const payload = body as Record<string, unknown>;
    const stakeholderId = payload.id;
    if (stakeholderId === undefined || stakeholderId === null || stakeholderId === '') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    return NextResponse.json(
      await endProjectStakeholder(params.id, actor, stakeholderId, payload),
    );
  },
  { schema: stakeholderEndSchema },
);
