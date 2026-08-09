import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  createOperationsExpense,
  findOperationsSystem,
  listOperationsExpenses,
} from '@/lib/repositories/operations.repo';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const sys = await findOperationsSystem(id, user.company_id, Boolean(user.is_admin));
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const expenses = await listOperationsExpenses(id);
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const sys = await findOperationsSystem(id, user.company_id, Boolean(user.is_admin));
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { expense_date, category, description, amount, reference } = body;

  const created = await createOperationsExpense(id, {
    expense_date, category, description, amount, reference,
  });
  return NextResponse.json(created, { status: 201 });
}
