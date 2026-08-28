import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listOperationsSystemsRepo,
  findOperationsSystemRepo,
  getOperationsSystemRepo,
  createOperationsSystemRepo,
  updateOperationsSystemRepo,
  deleteOperationsSystemRepo,
  listOperationsBudgetItemsRepo,
  listOperationsExpensesRepo,
  listOperationsIncidentsRepo,
  deleteOperationsBudgetItemRepo,
  deleteOperationsExpenseRepo,
  deleteOperationsIncidentRepo,
} = vi.hoisted(() => ({
  listOperationsSystemsRepo: vi.fn(),
  findOperationsSystemRepo: vi.fn(),
  getOperationsSystemRepo: vi.fn(),
  createOperationsSystemRepo: vi.fn(),
  updateOperationsSystemRepo: vi.fn(),
  deleteOperationsSystemRepo: vi.fn(),
  listOperationsBudgetItemsRepo: vi.fn(),
  listOperationsExpensesRepo: vi.fn(),
  listOperationsIncidentsRepo: vi.fn(),
  deleteOperationsBudgetItemRepo: vi.fn(),
  deleteOperationsExpenseRepo: vi.fn(),
  deleteOperationsIncidentRepo: vi.fn(),
}));

vi.mock('@/lib/repositories/operations.repo', () => ({
  listOperationsSystems: listOperationsSystemsRepo,
  findOperationsSystem: findOperationsSystemRepo,
  getOperationsSystem: getOperationsSystemRepo,
  createOperationsSystem: createOperationsSystemRepo,
  updateOperationsSystem: updateOperationsSystemRepo,
  deleteOperationsSystem: deleteOperationsSystemRepo,
  listOperationsBudgetItems: listOperationsBudgetItemsRepo,
  listOperationsExpenses: listOperationsExpensesRepo,
  listOperationsIncidents: listOperationsIncidentsRepo,
  createOperationsBudgetItem: vi.fn(),
  updateOperationsBudgetItem: vi.fn(),
  deleteOperationsBudgetItem: deleteOperationsBudgetItemRepo,
  createOperationsExpense: vi.fn(),
  deleteOperationsExpense: deleteOperationsExpenseRepo,
  createOperationsIncident: vi.fn(),
  updateOperationsIncident: vi.fn(),
  deleteOperationsIncident: deleteOperationsIncidentRepo,
}));

import type { SessionUser } from '@/lib/auth';
import {
  deleteBudgetItemForSystem,
  deleteExpenseForSystem,
  deleteIncidentForSystem,
  deleteOperationsSystemForUser,
  getOperationsSystemDetail,
  listBudgetItemsForSystem,
  listOperationsSystems,
} from './operations.service';

const user: SessionUser = {
  id: 1,
  username: 'ops',
  display_name: 'Ops User',
  company_id: 5,
  company_name: 'Acme',
  is_admin: 0,
  onboarding_completed: 1,
  roles: [],
  status: 'active',
  email: 'ops@acme.com',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('operations.service pass-through', () => {
  it('listOperationsSystems calls repo with company_id and is_admin', async () => {
    listOperationsSystemsRepo.mockResolvedValue([{ id: 1, name: 'Sys' }]);
    await expect(listOperationsSystems(user)).resolves.toEqual([{ id: 1, name: 'Sys' }]);
    expect(listOperationsSystemsRepo).toHaveBeenCalledWith(5, false);
  });

  it('getOperationsSystemDetail returns null when system missing and skips nested lists', async () => {
    getOperationsSystemRepo.mockResolvedValue(undefined);
    await expect(getOperationsSystemDetail(user, 99)).resolves.toBeNull();
    expect(listOperationsBudgetItemsRepo).not.toHaveBeenCalled();
    expect(listOperationsExpensesRepo).not.toHaveBeenCalled();
    expect(listOperationsIncidentsRepo).not.toHaveBeenCalled();
  });

  it('listBudgetItemsForSystem returns null when find misses and does not list', async () => {
    findOperationsSystemRepo.mockResolvedValue(undefined);
    await expect(listBudgetItemsForSystem(user, 99)).resolves.toBeNull();
    expect(listOperationsBudgetItemsRepo).not.toHaveBeenCalled();
  });
});

describe('operations.service nested deletes (CR-01)', () => {
  beforeEach(() => {
    findOperationsSystemRepo.mockResolvedValue({ id: 42 });
  });

  it('deleteBudgetItemForSystem returns null when system missing', async () => {
    findOperationsSystemRepo.mockResolvedValue(undefined);
    await expect(deleteBudgetItemForSystem(user, 99, 1)).resolves.toBeNull();
    expect(deleteOperationsBudgetItemRepo).not.toHaveBeenCalled();
  });

  it('deleteBudgetItemForSystem returns false when item row not deleted', async () => {
    deleteOperationsBudgetItemRepo.mockResolvedValue({ changes: 0 });
    await expect(deleteBudgetItemForSystem(user, 42, 999)).resolves.toBe(false);
  });

  it('deleteBudgetItemForSystem returns true when item deleted', async () => {
    deleteOperationsBudgetItemRepo.mockResolvedValue({ changes: 1 });
    await expect(deleteBudgetItemForSystem(user, 42, 1)).resolves.toBe(true);
  });

  it('deleteExpenseForSystem returns false when expense row not deleted', async () => {
    deleteOperationsExpenseRepo.mockResolvedValue({ changes: 0 });
    await expect(deleteExpenseForSystem(user, 42, 999)).resolves.toBe(false);
  });

  it('deleteIncidentForSystem returns false when incident row not deleted', async () => {
    deleteOperationsIncidentRepo.mockResolvedValue({ changes: 0 });
    await expect(deleteIncidentForSystem(user, 42, 999)).resolves.toBe(false);
  });
});

describe('operations.service system delete (CR-02)', () => {
  it('deleteOperationsSystemForUser returns false when system missing', async () => {
    findOperationsSystemRepo.mockResolvedValue(undefined);
    await expect(deleteOperationsSystemForUser(user, 99)).resolves.toBe(false);
    expect(deleteOperationsSystemRepo).not.toHaveBeenCalled();
  });

  it('deleteOperationsSystemForUser returns false when delete affects zero rows', async () => {
    findOperationsSystemRepo.mockResolvedValue({ id: 42 });
    deleteOperationsSystemRepo.mockResolvedValue({ changes: 0 });
    await expect(deleteOperationsSystemForUser(user, 42)).resolves.toBe(false);
  });

  it('deleteOperationsSystemForUser returns true when delete succeeds', async () => {
    findOperationsSystemRepo.mockResolvedValue({ id: 42 });
    deleteOperationsSystemRepo.mockResolvedValue({ changes: 1 });
    await expect(deleteOperationsSystemForUser(user, 42)).resolves.toBe(true);
  });
});
