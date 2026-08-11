import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { createExpense, listExpenses, type ExpenseBody } from '@/lib/services/budget-items.service';
import { expenseInputSchema } from './schema';

type Params = { id: string; itemId: string };

export const GET = withProjectAccess<Params>(async (_req, { params, actor }) =>
  NextResponse.json(await listExpenses(params.id, params.itemId, actor)),
);

export const POST = withProjectAccess<Params>(
  async (_req, { params, actor, body }) =>
    NextResponse.json(
      await createExpense(params.id, params.itemId, actor, body as ExpenseBody),
      { status: 201 },
    ),
  { schema: expenseInputSchema },
);
