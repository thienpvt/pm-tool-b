import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { toAccessActor } from '@/lib/services/access';
import { deleteProgramAllocation, updateProgramAllocation } from '@/modules/portfolio/backend/services/portfolio.service';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { allocated_headcount } = await req.json();
  try {
    const result = await updateProgramAllocation(id, toAccessActor(user), allocated_headcount);
    return NextResponse.json(result);
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await deleteProgramAllocation(id, toAccessActor(user));
  return NextResponse.json({ ok: true });
}
