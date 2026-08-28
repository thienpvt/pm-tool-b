import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import {
  createTeamMember,
  deleteTeamMember,
  listTeam,
  updateTeamMember,
} from '@/modules/projects/backend/services/team.service';

export async function getTeamHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  return NextResponse.json(await listTeam(params.id, actor));
}

export async function postTeamHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  return NextResponse.json(
    await createTeamMember(params.id, actor, body as Record<string, unknown>),
    { status: 201 },
  );
}

export async function putTeamHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  const { id: rowId, ...fields } = body as Record<string, unknown>;
  return NextResponse.json(
    await updateTeamMember(params.id, actor, rowId as string | number, fields),
  );
}

export async function deleteTeamHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const rowId = new URL(_req.url).searchParams.get('rowId') ?? '';
  await deleteTeamMember(params.id, actor, rowId);
  return NextResponse.json({ ok: true });
}
