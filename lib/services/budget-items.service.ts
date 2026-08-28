import {
  createExpense as createExpenseRepo,
  deleteBudgetItem as deleteBudgetItemRepo,
  deleteExpense as deleteExpenseRepo,
  getBudgetItemInProject,
  getExpenseInItem,
  listExpensesByItem,
  updateBudgetItem as updateBudgetItemRepo,
} from '@/lib/repositories/budget.repo';
import { assertProjectAccess, assertProjectWriteAccess, type AccessActor } from './access';
import { NotFoundError, ValidationError } from './errors';

/**
 * Nested budget-item + expense operations for the three routes under
 * `app/api/projects/[id]/budget/[itemId]/`. Each call asserts project ownership
 * FIRST via the canonical `assertProjectAccess`, replacing the three file-local
 * `authorize()` copies that used to collapse cross-company to 401 (T-04-23:
 * unified on 403, matching what 04-03 already did to the parent budget route).
 */

export type BudgetItemBody = {
  type: string;
  group_name?: string;
  name: string;
  planned_amount?: number | string;
  approved_amount?: number | string;
  actual_amount?: number | string;
  unit?: string;
  notes?: string;
};

export async function updateBudgetItem(
  projectId: number | string,
  itemId: number | string,
  actor: AccessActor,
  body: BudgetItemBody,
) {
  await assertProjectWriteAccess(projectId, actor);
  if (!body.name?.trim()) throw new ValidationError('Name is required', 'name');
  if (!['CAPEX', 'OPEX'].includes(body.type)) throw new ValidationError('Invalid type', 'type');
  const updated = await updateBudgetItemRepo(projectId, itemId, body);
  if (!updated) throw new NotFoundError('Not found', 'budget_item');
  return updated;
}

export async function deleteBudgetItem(
  projectId: number | string,
  itemId: number | string,
  actor: AccessActor,
) {
  await assertProjectWriteAccess(projectId, actor);
  return deleteBudgetItemRepo(projectId, itemId);
}

export async function listExpenses(
  projectId: number | string,
  itemId: number | string,
  actor: AccessActor,
) {
  await assertProjectAccess(projectId, actor);
  return listExpensesByItem(projectId, itemId);
}

export type ExpenseBody = {
  expense_date?: string;
  description: string;
  amount?: number | string;
  reference?: string;
};

export async function createExpense(
  projectId: number | string,
  itemId: number | string,
  actor: AccessActor,
  body: ExpenseBody,
) {
  await assertProjectWriteAccess(projectId, actor);
  if (!body.description?.trim()) throw new ValidationError('Description is required', 'description');
  // Scoping guard: the item must belong to the asserted project before an expense
  // can be attached to it.
  const item = await getBudgetItemInProject(projectId, itemId);
  if (!item) throw new NotFoundError('Budget item not found', 'budget_item');
  return createExpenseRepo(projectId, itemId, body);
}

export async function deleteExpense(
  projectId: number | string,
  itemId: number | string,
  expId: number | string,
  actor: AccessActor,
) {
  await assertProjectWriteAccess(projectId, actor);
  // Scoping guard: an expense belonging to a different item/project 404s rather
  // than silently no-op deleting (matches createExpense's item-scoping check).
  const expense = await getExpenseInItem(projectId, itemId, expId);
  if (!expense) throw new NotFoundError('Not found', 'budget_expense');
  return deleteExpenseRepo(projectId, itemId, expId);
}
