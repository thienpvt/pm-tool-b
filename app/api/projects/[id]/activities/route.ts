import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { repoErrorResponse, serviceErrorResponse } from '@/lib/api-errors';
import { UnknownColumnError } from '@/lib/repositories/_helpers';
import {
  createActivity,
  deleteActivity,
  listActivities,
  updateActivity,
} from '@/lib/services/activities.service';

type Params = { params: Promise<{ id: string }> };

function actorOf(user: { company_id: number | null; is_admin: number }) {
  return { company_id: user.company_id, is_admin: user.is_admin };
}

function mapError(e: unknown) {
  if (e instanceof UnknownColumnError) return repoErrorResponse(e);
  return serviceErrorResponse(e);
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await listActivities(id, actorOf(user)));
  } catch (e) {
    return mapError(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    return NextResponse.json(await createActivity(id, actorOf(user), body), { status: 201 });
  } catch (e) {
    return mapError(e);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { id: rowId, ...fields } = body;
    return NextResponse.json(await updateActivity(id, actorOf(user), rowId, fields));
  } catch (e) {
    return mapError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  try {
    await deleteActivity(id, actorOf(user), searchParams.get('rowId') ?? '');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return mapError(e);
  }
}
