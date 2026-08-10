import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { deleteMilestone, updateMilestone } from '@/lib/services/milestones.service';

type Params = { params: Promise<{ id: string; milestoneId: string }> };

function actorOf(user: { company_id: number | null; is_admin: number }) {
  return { company_id: user.company_id, is_admin: user.is_admin };
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id, milestoneId } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    return NextResponse.json(await updateMilestone(id, actorOf(user), milestoneId, body));
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, milestoneId } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await deleteMilestone(id, actorOf(user), milestoneId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serviceErrorResponse(e);
  }
}
