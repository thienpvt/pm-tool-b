import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { deleteExpense } from '@/lib/services/budget-items.service';

type Ctx = { params: Promise<{ id: string; itemId: string; expId: string }> };

function actorOf(user: { company_id: number | null; is_admin: number }) {
  return { company_id: user.company_id, is_admin: user.is_admin };
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id, itemId, expId } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await deleteExpense(id, itemId, expId, actorOf(user));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serviceErrorResponse(e);
  }
}
