import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { toAccessActor } from '@/lib/services/access';
import { deleteBudgetAllocation, updateBudgetAllocation } from '@/modules/portfolio/backend/services/portfolio.service';

type Params = { params: Promise<{ id: string; allocId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, allocId } = await params;
  const body = await req.json();
  try {
    const updated = await updateBudgetAllocation(id, allocId, toAccessActor(user), body);
    return NextResponse.json(updated);
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, allocId } = await params;
  try {
    await deleteBudgetAllocation(id, allocId, toAccessActor(user));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serviceErrorResponse(e);
  }
}
