import {
  activityStats,
  createBudgetItem as createBudgetItemRepo,
  listBudgetItems,
  listExpenses,
} from '@/lib/repositories/budget.repo';
import { assertProjectAccess, type AccessActor } from './access';
import { ValidationError } from './errors';

/**
 * GET composition: items + expenses grouped by budget_item_id + rounded avg completion.
 * Rounding and grouping key preserved verbatim from the prior route.
 */
export async function getBudgetOverview(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);

  const [items, expenses, stats] = await Promise.all([
    listBudgetItems(projectId),
    listExpenses(projectId),
    activityStats(projectId),
  ]);

  const expByItem = new Map<number, unknown[]>();
  for (const e of expenses) {
    const bid = (e as { budget_item_id: number }).budget_item_id;
    if (!expByItem.has(bid)) expByItem.set(bid, []);
    expByItem.get(bid)!.push(e);
  }
  const itemsWithExpenses = items.map(i => ({
    ...i,
    expenses: expByItem.get((i as { id: number }).id) ?? [],
  }));

  return {
    items: itemsWithExpenses,
    completion_pct: Math.round(stats?.avg_pct ?? 0),
  };
}

export async function createBudgetItem(
  projectId: number | string,
  actor: AccessActor,
  body: {
    type?: string;
    name?: string;
    group_name?: string;
    planned_amount?: number | string;
    approved_amount?: number | string;
    actual_amount?: number | string;
    unit?: string;
    notes?: string;
  },
) {
  await assertProjectAccess(projectId, actor);
  if (!body.name?.trim()) throw new ValidationError('Name is required', 'name');
  if (!body.type || !['CAPEX', 'OPEX'].includes(body.type)) {
    throw new ValidationError('Invalid type', 'type');
  }
  return createBudgetItemRepo(projectId, {
    type: body.type,
    group_name: body.group_name,
    name: body.name,
    planned_amount: body.planned_amount,
    approved_amount: body.approved_amount,
    actual_amount: body.actual_amount,
    unit: body.unit,
    notes: body.notes,
  });
}
