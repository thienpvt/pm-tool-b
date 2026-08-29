import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';

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

function deleteResult(numDeletedRows: bigint | number | undefined) {
  return { lastInsertRowid: 0, changes: Number(numDeletedRows ?? 0) };
}

// ── Budget items ──────────────────────────────────────────────────────────────

export async function listBudgetItems(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('budget_items')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('type')
    .orderBy('group_name')
    .orderBy('created_at')
    .execute();
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
  const db = await getKysely();
  return db
    .insertInto('budget_items')
    .values({
      project_id: Number(projectId),
      type: body.type,
      group_name: body.group_name?.trim() ?? '',
      name: body.name.trim(),
      planned_amount: Number(body.planned_amount) || 0,
      approved_amount: Number(body.approved_amount) || 0,
      actual_amount: Number(body.actual_amount) || 0,
      unit: body.unit?.trim() || 'USD',
      notes: body.notes?.trim() ?? '',
    })
    .returningAll()
    .executeTakeFirstOrThrow();
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
  const db = await getKysely();
  return db
    .updateTable('budget_items')
    .set({
      type: body.type,
      group_name: body.group_name?.trim() ?? '',
      name: body.name.trim(),
      planned_amount: Number(body.planned_amount) || 0,
      approved_amount: Number(body.approved_amount) || 0,
      actual_amount: Number(body.actual_amount) || 0,
      unit: body.unit?.trim() || 'USD',
      notes: body.notes?.trim() ?? '',
    })
    .where('id', '=', Number(itemId))
    .where('project_id', '=', Number(projectId))
    .returningAll()
    .executeTakeFirst();
}

export async function deleteBudgetItem(projectId: number | string, itemId: number | string) {
  const db = await getKysely();
  const result = await db
    .deleteFrom('budget_items')
    .where('id', '=', Number(itemId))
    .where('project_id', '=', Number(projectId))
    .execute();
  return deleteResult(result.numDeletedRows);
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function listExpenses(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('budget_expenses')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('expense_date')
    .orderBy('created_at')
    .execute();
}

export async function listExpensesByItem(projectId: number | string, itemId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('budget_expenses')
    .selectAll()
    .where('budget_item_id', '=', Number(itemId))
    .where('project_id', '=', Number(projectId))
    .orderBy('expense_date')
    .orderBy('created_at')
    .execute();
}

export async function getBudgetItemInProject(projectId: number | string, itemId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('budget_items')
    .select('id')
    .where('id', '=', Number(itemId))
    .where('project_id', '=', Number(projectId))
    .executeTakeFirst();
}

/** Scoping guard for a single expense: exists only if it belongs to both the item and the project. */
export async function getExpenseInItem(
  projectId: number | string,
  itemId: number | string,
  expId: number | string,
) {
  const db = await getKysely();
  return db
    .selectFrom('budget_expenses')
    .select('id')
    .where('id', '=', Number(expId))
    .where('budget_item_id', '=', Number(itemId))
    .where('project_id', '=', Number(projectId))
    .executeTakeFirst();
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
  const db = await getKysely();
  const row = await db
    .insertInto('budget_expenses')
    .values({
      budget_item_id: Number(itemId),
      project_id: Number(projectId),
      expense_date: body.expense_date || new Date().toISOString().slice(0, 10),
      description: body.description.trim(),
      amount: Number(body.amount) || 0,
      reference: body.reference?.trim() ?? '',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await _syncActualAmount(Number(itemId), Number(projectId));
  return row;
}

/** Delete an expense and sync `actual_amount` on the parent item. */
export async function deleteExpense(
  projectId: number | string,
  itemId: number | string,
  expId: number | string,
) {
  const db = await getKysely();
  await db
    .deleteFrom('budget_expenses')
    .where('id', '=', Number(expId))
    .where('budget_item_id', '=', Number(itemId))
    .where('project_id', '=', Number(projectId))
    .execute();
  await _syncActualAmount(Number(itemId), Number(projectId));
  return { ok: true };
}

/** Activity completion stats for the budget overview panel. */
export async function activityStats(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('activities')
    .select([
      sql<number>`AVG(completion_pct)`.as('avg_pct'),
      sql<number>`COUNT(*)`.as('total'),
    ])
    .where('project_id', '=', Number(projectId))
    .executeTakeFirst();
}

// ── Internal ──────────────────────────────────────────────────────────────────

async function _syncActualAmount(itemId: number, projectId: number) {
  const db = await getKysely();
  await db
    .updateTable('budget_items')
    .set({
      actual_amount: sql`(SELECT COALESCE(SUM(amount), 0) FROM budget_expenses WHERE budget_item_id = ${itemId})`,
    })
    .where('id', '=', itemId)
    .where('project_id', '=', projectId)
    .execute();
}
