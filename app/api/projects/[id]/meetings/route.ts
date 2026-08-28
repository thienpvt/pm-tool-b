import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  createMeeting,
  deleteMeeting,
  listMeetings,
  updateMeeting,
} from '@/modules/projects/backend/services/meetings.service';
import { meetingInputSchema, meetingUpdateSchema } from './schema';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listMeetings(params.id, actor)),
);

export const POST = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(await createMeeting(params.id, actor, body as Record<string, unknown>), { status: 201 }),
  { schema: meetingInputSchema },
);

export const PUT = withProjectAccess(
  async (_req, { params, actor, body }) => {
    const { id: rowId, ...fields } = body as Record<string, unknown>;
    return NextResponse.json(await updateMeeting(params.id, actor, rowId as string | number, fields));
  },
  { schema: meetingUpdateSchema },
);

export const DELETE = withProjectAccess(async (req, { params, actor }) => {
  const rowId = new URL(req.url).searchParams.get('rowId') ?? '';
  await deleteMeeting(params.id, actor, rowId);
  return NextResponse.json({ ok: true });
});
