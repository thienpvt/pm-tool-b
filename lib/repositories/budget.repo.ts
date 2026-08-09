import { getDb } from '@/lib/db';

/**
 * Budget items and their expenses.
 *
 * Writes are fixed-column (no `Object.keys(body)` anywhere in the budget routes),
 * so no allowlist is required — see ALLOWLIST-DIFF.md.
 *
 * The `actual_amount` on a budget item is kept in sync with the sum of its expenses
 * after every expense insert or delete. That aggregate update is part of the write
 * logic and belongs here, not in the route.
 *
 * Note: these routes already call an `authorize()` helper before any DB work.
 * The repository does not repeat that check — REPO-02 (no session inside repositories).
 */

// ── Budget items ──────────────────────────────────────────────────────────────

export async function listBudgetItems(projectId: number | string) {
  const db = await getDb();
  return db.all('SELECT * FROM budget_items WHERE project_id = ? ORDER BY type, group_name, created_at', projectId);
}

export async function createBudgetItem(
  projectId: number | string,
  body: {
    type: string;
    group_name?: string;
    name: string;
    planned_amount?: number | string;
    approved_amount?: number | string;
    actual_amount?: number | string;
    unit?: string;
    notes?: string;
  },
) {
  const db = await getDb();
  const result = await db.run(
    `INSERT INTO budget_items (project_id, type, group_name, name, planned_amount, approved_amount, actual_amount, unit, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    projectId,
    body.type,
    body.group_name?.trim() ?? '',
    body.name.trim(),
    Number(body.planned_amount) || 0,
    Number(body.approved_amount) || 0,
    Number(body.actual_amount) || 0,
    body.unit?.trim() || 'USD',
    body.notes?.trim() ?? '',
  );
  return db.get('SELECT * FROM budget_items WHERE id = ?', result.lastInsertRowid);
}

export async function updateBudgetItem(
  projectId: number | string,
  itemId: number | string,
  body: {
    type: string;
    group_name?: string;
    name: string;
    planned_amount?: number | string;
    approved_amount?: number | string;
    actual_amount?: number | string;
    unit?: string;
    notes?: string;
  },
) {
  const db = await getDb();
  return db.get(
    `UPDATE budget_items SET type=?, group_name=?, name=?, planned_amount=?, approved_amount=?, actual_amount=?, unit=?, notes=?
     WHERE id=? AND project_id=? RETURNING *`,
    body.type,
    body.group_name?.trim() ?? '',
    body.name.trim(),
    Number(body.planned_amount) || 0,
    Number(body.approved_amount) || 0,
    Number(body.actual_amount) || 0,
    body.unit?.trim() || 'USD',
    body.notes?.trim() ?? '',
    itemId,
    projectId,
  );
}

export async function deleteBudgetItem(projectId: number | string, itemId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM budget_items WHERE id = ? AND project_id = ?', itemId, projectId);
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function listExpenses(projectId: number | string) {
  const db = await getDb();
  return db.all(
    'SELECT * FROM budget_expenses WHERE project_id = ? ORDER BY expense_date, created_at',
    projectId,
  );
}

export async function listExpensesByItem(projectId: number | string, itemId: number | string) {
  const db = await getDb();
  return db.all(
    'SELECT * FROM budget_expenses WHERE budget_item_id = ? AND project_id = ? ORDER BY expense_date, created_at',
    itemId, projectId,
  );
}

export async function getBudgetItemInProject(projectId: number | string, itemId: number | string) {
  const db = await getDb();
  return db.get<{ id: number }>('SELECT id FROM budget_items WHERE id = ? AND project_id = ?', itemId, projectId);
}

/** Create an expense and sync `actual_amount` on the parent item. */
export async function createExpense(
  projectId: number | string,
  itemId: number | string,
  body: {
    expense_date?: string;
    description: string;
    amount?: number | string;
    reference?: string;
  },
) {
  const db = await getDb();
  const result = await db.run(
    `INSERT INTO budget_expenses (budget_item_id, project_id, expense_date, description, amount, reference)
     VALUES (?, ?, ?, ?, ?, ?)`,
    itemId, projectId,
    body.expense_date || new Date().toISOString().slice(0, 10),
    body.description.trim(),
    Number(body.amount) || 0,
    body.reference?.trim() ?? '',
  );

  // Keep actual_amount in sync with the sum of all expenses for this item.
  await _syncActualAmount(db, itemId, projectId);

  return db.get('SELECT * FROM budget_expenses WHERE id = ?', result.lastInsertRowid);
}

/** Delete an expense and sync `actual_amount` on the parent item. */
export async function deleteExpense(
  projectId: number | string,
  itemId: number | string,
  expId: number | string,
) {
  const db = await getDb();
  await db.run(
    'DELETE FROM budget_expenses WHERE id = ? AND budget_item_id = ? AND project_id = ?',
    expId, itemId, projectId,
  );
  await _syncActualAmount(db, itemId, projectId);
  return { ok: true };
}

/** Activity completion stats for the budget overview panel. */
export async function activityStats(projectId: number | string) {
  const db = await getDb();
  return db.get<{ avg_pct: number; total: number }>(
    'SELECT AVG(completion_pct) as avg_pct, COUNT(*) as total FROM activities WHERE project_id = ?',
    projectId,
  );
}

// ── Internal ──────────────────────────────────────────────────────────────────

import type { DbClient } from '@/lib/db';

async function _syncActualAmount(
  db: DbClient,
  itemId: number | string,
  projectId: number | string,
) {
  await db.run(
    `UPDATE budget_items SET actual_amount = (
      SELECT COALESCE(SUM(amount), 0) FROM budget_expenses WHERE budget_item_id = ?
    ) WHERE id = ? AND project_id = ?`,
    itemId, itemId, projectId,
  );
}
