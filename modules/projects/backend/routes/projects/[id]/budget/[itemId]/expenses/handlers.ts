import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { createExpense, listExpenses, type ExpenseBody } from '@/modules/projects/backend/services/budget-items.service';
import { expenseInputSchema } from './schema';
type Params = { id: string; itemId: string };

export async function getBudgetItemIdExpensesHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await listExpenses(params.id, params.itemId, actor)); }

export async function postBudgetItemIdExpensesHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) { return NextResponse.json(
      await createExpense(params.id, params.itemId, actor, body as ExpenseBody),
      { status: 201 },
    ); }
