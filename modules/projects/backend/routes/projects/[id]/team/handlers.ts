import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import {
import { teamInputSchema, teamUpdateSchema } from './schema';

export async function getTeamHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await listTeam(params.id, actor)); }

export async function postTeamHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await createTeamMember(params.id, actor, body as Record<string, unknown>), { status: 201 }); }

export async function putTeamHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
    const { id: rowId, ...fields } = body as Record<string, unknown>;
    return NextResponse.json(await updateTeamMember(params.id, actor, rowId as string | number, fields));
  },
  { schema: teamUpdateSchema },

export async function deleteTeamHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const rowId = new URL(req.url).searchParams.get('rowId') ?? '';
  await deleteTeamMember(params.id, actor, rowId);
  return NextResponse.json({ ok: true });
}
