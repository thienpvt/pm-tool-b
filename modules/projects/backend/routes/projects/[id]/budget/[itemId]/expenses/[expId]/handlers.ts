import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { deleteExpense } from '@/modules/projects/backend/services/budget-items.service';
type Params = { id: string; itemId: string; expId: string };

export async function deleteBudgetItemIdExpensesExpIdHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  await deleteExpense(params.id, params.itemId, params.expId, actor);
  return NextResponse.json({ ok: true });
}
