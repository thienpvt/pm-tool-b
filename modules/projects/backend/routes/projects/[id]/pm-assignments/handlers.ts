import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import {
  createPmAssignment,
  endPmAssignment,
  listPmAssignments,
} from '@/modules/projects/backend/services/pm-assignments.service';

export async function getPmAssignmentsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  return NextResponse.json(await listPmAssignments(params.id, actor));
}

export async function postPmAssignmentsHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  return NextResponse.json(
    await createPmAssignment(params.id, actor, body as Record<string, unknown>),
    { status: 201 },
  );
}

export async function patchPmAssignmentsHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  const payload = body as Record<string, unknown>;
  const assignmentId = payload.id;
  if (assignmentId === undefined || assignmentId === null || assignmentId === '') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }
  return NextResponse.json(await endPmAssignment(params.id, actor, assignmentId, payload));
}
