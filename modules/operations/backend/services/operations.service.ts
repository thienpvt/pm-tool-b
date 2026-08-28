import type { SessionUser } from '@/lib/auth';
import {
  createOperationsBudgetItem as createOperationsBudgetItemRepo,
  createOperationsExpense as createOperationsExpenseRepo,
  createOperationsIncident as createOperationsIncidentRepo,
  createOperationsSystem as createOperationsSystemRepo,
  deleteOperationsBudgetItem as deleteOperationsBudgetItemRepo,
  deleteOperationsExpense as deleteOperationsExpenseRepo,
  deleteOperationsIncident as deleteOperationsIncidentRepo,
  deleteOperationsSystem as deleteOperationsSystemRepo,
  findOperationsSystem as findOperationsSystemRepo,
  getOperationsSystem as getOperationsSystemRepo,
  listOperationsBudgetItems as listOperationsBudgetItemsRepo,
  listOperationsExpenses as listOperationsExpensesRepo,
  listOperationsIncidents as listOperationsIncidentsRepo,
  listOperationsSystems as listOperationsSystemsRepo,
  updateOperationsBudgetItem as updateOperationsBudgetItemRepo,
  updateOperationsIncident as updateOperationsIncidentRepo,
  updateOperationsSystem as updateOperationsSystemRepo,
} from '@/modules/operations/backend/repositories/operations.repo';

export async function listOperationsSystems(user: SessionUser) {
  return listOperationsSystemsRepo(user.company_id, Boolean(user.is_admin));
}

export async function createOperationsSystem(
  user: SessionUser,
  input: {
    project_id?: number | string | null;
    name: string;
    description?: string;
    go_live_date?: string | null;
    status?: string;
  },
) {
  return createOperationsSystemRepo(user.company_id, input);
}

export async function findOperationsSystemForUser(user: SessionUser, id: number | string) {
  return findOperationsSystemRepo(id, user.company_id, Boolean(user.is_admin));
}

export async function getOperationsSystemDetail(user: SessionUser, id: number | string) {
  const system = await getOperationsSystemRepo(id, user.company_id, Boolean(user.is_admin));
  if (!system) return null;

  const [budgetItems, expenses, incidents] = await Promise.all([
    listOperationsBudgetItemsRepo(id),
    listOperationsExpensesRepo(id),
    listOperationsIncidentsRepo(id),
  ]);

  return { system, budgetItems, expenses, incidents };
}

export async function updateOperationsSystemForUser(
  user: SessionUser,
  id: number | string,
  patch: Record<string, unknown>,
) {
  const existing = await findOperationsSystemForUser(user, id);
  if (!existing) return null;
  return updateOperationsSystemRepo(id, patch);
}

export async function deleteOperationsSystemForUser(user: SessionUser, id: number | string) {
  const existing = await findOperationsSystemForUser(user, id);
  if (!existing) return false;
  const result = await deleteOperationsSystemRepo(id, user.company_id, Boolean(user.is_admin));
  return (result.changes ?? 0) > 0;
}

export async function listBudgetItemsForSystem(user: SessionUser, id: number | string) {
  const existing = await findOperationsSystemForUser(user, id);
  if (!existing) return null;
  return listOperationsBudgetItemsRepo(id);
}

export async function createBudgetItemForSystem(
  user: SessionUser,
  id: number | string,
  input: Record<string, unknown>,
) {
  const existing = await findOperationsSystemForUser(user, id);
  if (!existing) return null;
  return createOperationsBudgetItemRepo(id, input);
}

export async function updateBudgetItemForSystem(
  user: SessionUser,
  id: number | string,
  itemId: number | string,
  patch: Record<string, unknown>,
) {
  const existing = await findOperationsSystemForUser(user, id);
  if (!existing) return null;
  return updateOperationsBudgetItemRepo(id, itemId, patch);
}

export async function deleteBudgetItemForSystem(
  user: SessionUser,
  id: number | string,
  itemId: number | string,
) {
  const existing = await findOperationsSystemForUser(user, id);
  if (!existing) return null;
  const result = await deleteOperationsBudgetItemRepo(id, itemId);
  return (result.changes ?? 0) > 0;
}

export async function listExpensesForSystem(user: SessionUser, id: number | string) {
  const existing = await findOperationsSystemForUser(user, id);
  if (!existing) return null;
  return listOperationsExpensesRepo(id);
}

export async function createExpenseForSystem(
  user: SessionUser,
  id: number | string,
  input: Record<string, unknown>,
) {
  const existing = await findOperationsSystemForUser(user, id);
  if (!existing) return null;
  return createOperationsExpenseRepo(id, input);
}

export async function deleteExpenseForSystem(
  user: SessionUser,
  id: number | string,
  expenseId: number | string,
) {
  const existing = await findOperationsSystemForUser(user, id);
  if (!existing) return null;
  const result = await deleteOperationsExpenseRepo(id, expenseId);
  return (result.changes ?? 0) > 0;
}

export async function listIncidentsForSystem(user: SessionUser, id: number | string) {
  const existing = await findOperationsSystemForUser(user, id);
  if (!existing) return null;
  return listOperationsIncidentsRepo(id);
}

export async function createIncidentForSystem(
  user: SessionUser,
  id: number | string,
  input: Record<string, unknown>,
) {
  const existing = await findOperationsSystemForUser(user, id);
  if (!existing) return null;
  return createOperationsIncidentRepo(id, input);
}

export async function updateIncidentForSystem(
  user: SessionUser,
  id: number | string,
  incidentId: number | string,
  patch: Record<string, unknown>,
) {
  const existing = await findOperationsSystemForUser(user, id);
  if (!existing) return null;
  return updateOperationsIncidentRepo(id, incidentId, patch);
}

export async function deleteIncidentForSystem(
  user: SessionUser,
  id: number | string,
  incidentId: number | string,
) {
  const existing = await findOperationsSystemForUser(user, id);
  if (!existing) return null;
  const result = await deleteOperationsIncidentRepo(id, incidentId);
  return (result.changes ?? 0) > 0;
}
