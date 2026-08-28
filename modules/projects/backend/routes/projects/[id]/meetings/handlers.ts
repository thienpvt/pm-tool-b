import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import {
  createMeeting,
  deleteMeeting,
  listMeetings,
  updateMeeting,
} from '@/modules/projects/backend/services/meetings.service';

export async function getMeetingsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  return NextResponse.json(await listMeetings(params.id, actor));
}

export async function postMeetingsHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  return NextResponse.json(
    await createMeeting(params.id, actor, body as Record<string, unknown>),
    { status: 201 },
  );
}

export async function putMeetingsHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  const { id: rowId, ...fields } = body as Record<string, unknown>;
  return NextResponse.json(
    await updateMeeting(params.id, actor, rowId as string | number, fields),
  );
}

export async function deleteMeetingsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const rowId = new URL(_req.url).searchParams.get('rowId') ?? '';
  await deleteMeeting(params.id, actor, rowId);
  return NextResponse.json({ ok: true });
}
