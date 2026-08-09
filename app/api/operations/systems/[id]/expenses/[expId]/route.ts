import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { deleteOperationsExpense, findOperationsSystem } from '@/lib/repositories/operations.repo';

type Params = { params: Promise<{ id: string; expId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, expId } = await params;
  const sys = await findOperationsSystem(id, user.company_id, Boolean(user.is_admin));
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await deleteOperationsExpense(id, expId);
  return NextResponse.json({ ok: true });
}
