import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  deleteOperationsBudgetItem,
  findOperationsSystem,
  updateOperationsBudgetItem,
} from '@/lib/repositories/operations.repo';

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, itemId } = await params;
  const sys = await findOperationsSystem(id, user.company_id, Boolean(user.is_admin));
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { category, name, planned_amount, actual_amount, unit, period_label, notes } = body;

  const updated = await updateOperationsBudgetItem(id, itemId, {
    category, name, planned_amount, actual_amount, unit, period_label, notes,
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, itemId } = await params;
  const sys = await findOperationsSystem(id, user.company_id, Boolean(user.is_admin));
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await deleteOperationsBudgetItem(id, itemId);
  return NextResponse.json({ ok: true });
}
