import { getDb } from '@/lib/db';

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
  const db = await getDb();
  const result = await db.run(
    `INSERT INTO budget_adjustments
       (fiscal_budget_id, amount_vnd, effective_date, reason, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    fiscalBudgetId,
    body.amount_vnd,
    body.effective_date,
    body.reason,
    body.created_by,
  );
  return db.get<BudgetAdjustmentRow>('SELECT * FROM budget_adjustments WHERE id = ?', result.lastInsertRowid);
}

export async function listBudgetAdjustments(fiscalBudgetId: number | string) {
  const db = await getDb();
  return db.all<BudgetAdjustmentRow>(
    `SELECT * FROM budget_adjustments
     WHERE fiscal_budget_id = ?
     ORDER BY effective_date DESC, created_at DESC`,
    fiscalBudgetId,
  );
}

export async function sumAdjustmentsVnd(fiscalBudgetId: number | string): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ total: string | number | null }>(
    'SELECT COALESCE(SUM(amount_vnd), 0) AS total FROM budget_adjustments WHERE fiscal_budget_id = ?',
    fiscalBudgetId,
  );
  return Number(row?.total ?? 0);
}
