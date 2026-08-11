import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  createTeamMember,
  deleteTeamMember,
  listTeam,
  updateTeamMember,
} from '@/lib/services/team.service';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listTeam(params.id, actor)),
);

export const POST = withProjectAccess(async (_req, { params, actor, body }) =>
  NextResponse.json(await createTeamMember(params.id, actor, body as Record<string, unknown>), { status: 201 }),
);

export const PUT = withProjectAccess(async (_req, { params, actor, body }) => {
  const { id: rowId, ...fields } = body as Record<string, unknown>;
  return NextResponse.json(await updateTeamMember(params.id, actor, rowId as string | number, fields));
});

export const DELETE = withProjectAccess(async (req, { params, actor }) => {
  const rowId = new URL(req.url).searchParams.get('rowId') ?? '';
  await deleteTeamMember(params.id, actor, rowId);
  return NextResponse.json({ ok: true });
});
