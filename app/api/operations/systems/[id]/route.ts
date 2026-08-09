import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  deleteOperationsSystem,
  findOperationsSystem,
  getOperationsSystem,
  listOperationsBudgetItems,
  listOperationsExpenses,
  listOperationsIncidents,
  updateOperationsSystem,
} from '@/lib/repositories/operations.repo';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const system = await getOperationsSystem(id, user.company_id, Boolean(user.is_admin));
  if (!system) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [budgetItems, expenses, incidents] = await Promise.all([
    listOperationsBudgetItems(id), listOperationsExpenses(id), listOperationsIncidents(id),
  ]);

  return NextResponse.json({ system, budgetItems, expenses, incidents });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await findOperationsSystem(id, user.company_id, Boolean(user.is_admin));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { name, description, project_id, go_live_date, status } = body;

  const updated = await updateOperationsSystem(id, {
    name, description, project_id, go_live_date, status,
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await deleteOperationsSystem(id, user.company_id, Boolean(user.is_admin));
  return NextResponse.json({ ok: true });
}
