import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import {
  deleteBudgetItem,
  updateBudgetItem,
  type BudgetItemBody,
} from '@/modules/projects/backend/services/budget-items.service';

type Params = { id: string; itemId: string };

export async function putBudgetItemIdHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<Params>,
) {
  return NextResponse.json(
    await updateBudgetItem(params.id, params.itemId, actor, body as BudgetItemBody),
  );
}

export async function deleteBudgetItemIdHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<Params>,
) {
  await deleteBudgetItem(params.id, params.itemId, actor);
  return NextResponse.json({ ok: true });
}
