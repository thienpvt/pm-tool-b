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
  deleteOperationsBudgetItem: vi.fn(),
  createOperationsExpense: vi.fn(),
  deleteOperationsExpense: vi.fn(),
  createOperationsIncident: vi.fn(),
  updateOperationsIncident: vi.fn(),
  deleteOperationsIncident: vi.fn(),
}));

import type { SessionUser } from '@/lib/auth';
import {
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
