import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { linkEpic, listEpics, unlinkEpic } from '@/lib/services/milestones.service';

type Params = { params: Promise<{ id: string; milestoneId: string }> };

function actorOf(user: { company_id: number | null; is_admin: number }) {
  return { company_id: user.company_id, is_admin: user.is_admin };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id, milestoneId } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await listEpics(id, actorOf(user), milestoneId));
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id, milestoneId } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    await linkEpic(id, actorOf(user), milestoneId, body.activity_id);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, milestoneId } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const activityId = new URL(req.url).searchParams.get('activity_id');
  try {
    await unlinkEpic(id, actorOf(user), milestoneId, activityId ?? '');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serviceErrorResponse(e);
  }
}
