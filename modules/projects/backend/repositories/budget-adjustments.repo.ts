import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';
import { coerceVndSafe } from '@/lib/fiscal/vnd';

export type BudgetAdjustmentRow = {
  id: number;
  fiscal_budget_id: number;
  amount_vnd: string | number;
  effective_date: string;
  reason: string;
  created_by: number | null;
  created_at: string;
};

export async function insertBudgetAdjustment(
  fiscalBudgetId: number | string,
  body: {
    amount_vnd: number;
    effective_date: string;
    reason: string;
    created_by: number;
  },
) {
  const db = await getKysely();
  return db
    .insertInto('budget_adjustments')
    .values({
      fiscal_budget_id: Number(fiscalBudgetId),
      amount_vnd: body.amount_vnd,
      effective_date: body.effective_date,
      reason: body.reason,
      created_by: body.created_by,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function listBudgetAdjustments(fiscalBudgetId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('budget_adjustments')
    .selectAll()
    .where('fiscal_budget_id', '=', Number(fiscalBudgetId))
    .orderBy('effective_date', 'desc')
    .orderBy('created_at', 'desc')
    .execute();
}

export async function sumAdjustmentsVnd(fiscalBudgetId: number | string): Promise<number> {
  const db = await getKysely();
  const row = await db
    .selectFrom('budget_adjustments')
    .select(sql<number>`COALESCE(SUM(amount_vnd), 0)`.as('total'))
    .where('fiscal_budget_id', '=', Number(fiscalBudgetId))
    .executeTakeFirst();
  return coerceVndSafe(row?.total ?? 0, 'amount_vnd');
}
