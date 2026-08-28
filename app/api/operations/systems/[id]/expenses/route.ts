import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  createExpenseForSystem,
  listExpensesForSystem,
} from '@/lib/services/operations.service';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const expenses = await listExpensesForSystem(user, id);
  if (expenses === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { expense_date, category, description, amount, reference } = body;

  const created = await createExpenseForSystem(user, id, {
    expense_date, category, description, amount, reference,
  });
  if (created === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(created, { status: 201 });
}
