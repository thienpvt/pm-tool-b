import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  createPmAssignment,
  endPmAssignment,
  listPmAssignments,
} from '@/lib/services/pm-assignments.service';
import { pmAssignmentCreateSchema, pmAssignmentEndSchema } from './schema';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listPmAssignments(params.id, actor)),
);

export const POST = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(
      await createPmAssignment(params.id, actor, body as Record<string, unknown>),
      { status: 201 },
    ),
  { schema: pmAssignmentCreateSchema },
);

export const PATCH = withProjectAccess(
  async (_req, { params, actor, body }) => {
    const payload = body as Record<string, unknown>;
    const assignmentId = payload.id;
    if (assignmentId === undefined || assignmentId === null || assignmentId === '') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    return NextResponse.json(
      await endPmAssignment(params.id, actor, assignmentId, payload),
    );
  },
  { schema: pmAssignmentEndSchema },
);
