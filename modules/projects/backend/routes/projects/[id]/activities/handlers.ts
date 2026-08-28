import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import {
import { activityInputSchema, activityUpdateSchema } from './schema';

export async function getActivitiesHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await listActivities(params.id, actor)); }

export async function postActivitiesHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await createActivity(params.id, actor, body as Record<string, unknown>), { status: 201 }); }

export async function putActivitiesHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
    const { id: rowId, ...fields } = body as Record<string, unknown>;
    return NextResponse.json(await updateActivity(params.id, actor, rowId as string | number, fields));
  },
  { schema: activityUpdateSchema },

export async function deleteActivitiesHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const rowId = new URL(req.url).searchParams.get('rowId') ?? '';
  await deleteActivity(params.id, actor, rowId);
  return NextResponse.json({ ok: true });
}
