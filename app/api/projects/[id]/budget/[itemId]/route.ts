import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  deleteBudgetItem,
  updateBudgetItem,
  type BudgetItemBody,
} from '@/modules/projects/backend/services/budget-items.service';
import { budgetItemUpdateSchema } from './schema';

type Params = { id: string; itemId: string };

export const PUT = withProjectAccess<Params>(
  async (_req, { params, actor, body }) =>
    NextResponse.json(
      await updateBudgetItem(params.id, params.itemId, actor, body as BudgetItemBody),
    ),
  { schema: budgetItemUpdateSchema },
);

export const DELETE = withProjectAccess<Params>(async (_req, { params, actor }) => {
  await deleteBudgetItem(params.id, params.itemId, actor);
  return NextResponse.json({ ok: true });
});
