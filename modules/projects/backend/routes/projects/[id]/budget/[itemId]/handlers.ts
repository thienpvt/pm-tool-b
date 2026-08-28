import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import {
import { budgetItemUpdateSchema } from './schema';
type Params = { id: string; itemId: string };

export async function putBudgetItemIdHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) { return NextResponse.json(
      await updateBudgetItem(params.id, params.itemId, actor, body as BudgetItemBody),
    ); }

export async function deleteBudgetItemIdHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  await deleteBudgetItem(params.id, params.itemId, actor);
  return NextResponse.json({ ok: true });
}
