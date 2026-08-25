import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  updateBudgetItemRepo,
  deleteBudgetItemRepo,
  listExpensesByItemRepo,
  getBudgetItemInProjectRepo,
  getExpenseInItemRepo,
  createExpenseRepo,
  deleteExpenseRepo,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  updateBudgetItemRepo: vi.fn(),
  deleteBudgetItemRepo: vi.fn(),
  listExpensesByItemRepo: vi.fn(),
  getBudgetItemInProjectRepo: vi.fn(),
  getExpenseInItemRepo: vi.fn(),
  createExpenseRepo: vi.fn(),
  deleteExpenseRepo: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/lib/repositories/budget.repo', () => ({
  updateBudgetItem: updateBudgetItemRepo,
  deleteBudgetItem: deleteBudgetItemRepo,
  listExpensesByItem: listExpensesByItemRepo,
  getBudgetItemInProject: getBudgetItemInProjectRepo,
  getExpenseInItem: getExpenseInItemRepo,
  createExpense: createExpenseRepo,
  deleteExpense: deleteExpenseRepo,
}));

import {
  createExpense,
  deleteBudgetItem,
  deleteExpense,
  listExpenses,
  updateBudgetItem,
} from './budget-items.service';
import { ForbiddenError, NotFoundError, ValidationError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  assertProjectWriteAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };
const validBody = { type: 'CAPEX', name: 'Servers' };

describe('budget-items.service', () => {
  describe('updateBudgetItem', () => {
    it('asserts write access before updating', async () => {
      updateBudgetItemRepo.mockResolvedValue({ id: 2, name: 'Servers' });
      await expect(updateBudgetItem(1, 2, owner, validBody)).resolves.toEqual({ id: 2, name: 'Servers' });
      expect(assertProjectWriteAccess).toHaveBeenCalledWith(1, owner);
      expect(updateBudgetItemRepo).toHaveBeenCalledWith(1, 2, validBody);
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(updateBudgetItem(1, 2, foreign, validBody)).rejects.toBeInstanceOf(ForbiddenError);
      expect(updateBudgetItemRepo).not.toHaveBeenCalled();
    });

    it('rejects a missing name with ValidationError', async () => {
      await expect(updateBudgetItem(1, 2, owner, { type: 'CAPEX', name: '  ' })).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(updateBudgetItemRepo).not.toHaveBeenCalled();
    });

    it('rejects an invalid type with ValidationError', async () => {
      await expect(
        updateBudgetItem(1, 2, owner, { type: 'BOGUS', name: 'Servers' }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(updateBudgetItemRepo).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the scoped update matches no row', async () => {
      updateBudgetItemRepo.mockResolvedValue(undefined);
      await expect(updateBudgetItem(1, 2, owner, validBody)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('deleteBudgetItem', () => {
    it('asserts write access before deleting', async () => {
      deleteBudgetItemRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 1 });
      await expect(deleteBudgetItem(1, 2, owner)).resolves.toEqual({ lastInsertRowid: 0, changes: 1 });
      expect(assertProjectWriteAccess).toHaveBeenCalledWith(1, owner);
      expect(deleteBudgetItemRepo).toHaveBeenCalledWith(1, 2);
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(deleteBudgetItem(1, 2, foreign)).rejects.toBeInstanceOf(ForbiddenError);
      expect(deleteBudgetItemRepo).not.toHaveBeenCalled();
    });
  });

  describe('listExpenses', () => {
    it('asserts access before listing', async () => {
      listExpensesByItemRepo.mockResolvedValue([{ id: 9 }]);
      await expect(listExpenses(1, 2, owner)).resolves.toEqual([{ id: 9 }]);
      expect(assertProjectAccess).toHaveBeenCalledWith(1, owner);
      expect(listExpensesByItemRepo).toHaveBeenCalledWith(1, 2);
    });

    it('does not call the repository when access is denied', async () => {
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      await expect(listExpenses(1, 2, foreign)).rejects.toBeInstanceOf(ForbiddenError);
      expect(listExpensesByItemRepo).not.toHaveBeenCalled();
    });
  });

  describe('createExpense', () => {
    const expenseBody = { description: 'Cloud bill' };

    it('asserts write access, then the item scoping guard, before creating', async () => {
      getBudgetItemInProjectRepo.mockResolvedValue({ id: 2 });
      createExpenseRepo.mockResolvedValue({ id: 9, description: 'Cloud bill' });

      await expect(createExpense(1, 2, owner, expenseBody)).resolves.toEqual({
        id: 9,
        description: 'Cloud bill',
      });
      expect(assertProjectWriteAccess).toHaveBeenCalledWith(1, owner);
      expect(getBudgetItemInProjectRepo).toHaveBeenCalledWith(1, 2);
      expect(createExpenseRepo).toHaveBeenCalledWith(1, 2, expenseBody);
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(createExpense(1, 2, foreign, expenseBody)).rejects.toBeInstanceOf(ForbiddenError);
      expect(getBudgetItemInProjectRepo).not.toHaveBeenCalled();
    });

    it('rejects an empty description with ValidationError', async () => {
      await expect(createExpense(1, 2, owner, { description: '  ' })).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(getBudgetItemInProjectRepo).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the item belongs to a different project/does not exist (scoping guard)', async () => {
      getBudgetItemInProjectRepo.mockResolvedValue(undefined);
      await expect(createExpense(1, 99, owner, expenseBody)).rejects.toBeInstanceOf(NotFoundError);
      expect(createExpenseRepo).not.toHaveBeenCalled();
    });
  });

  describe('deleteExpense', () => {
    it('asserts write access, then the scoping guard, before deleting', async () => {
      getExpenseInItemRepo.mockResolvedValue({ id: 9 });
      deleteExpenseRepo.mockResolvedValue({ ok: true });
      await expect(deleteExpense(1, 2, 9, owner)).resolves.toEqual({ ok: true });
      expect(assertProjectWriteAccess).toHaveBeenCalledWith(1, owner);
      expect(getExpenseInItemRepo).toHaveBeenCalledWith(1, 2, 9);
      expect(deleteExpenseRepo).toHaveBeenCalledWith(1, 2, 9);
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(deleteExpense(1, 2, 9, foreign)).rejects.toBeInstanceOf(ForbiddenError);
      expect(getExpenseInItemRepo).not.toHaveBeenCalled();
      expect(deleteExpenseRepo).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the expense belongs to a different item (scoping guard)', async () => {
      getExpenseInItemRepo.mockResolvedValue(undefined);
      await expect(deleteExpense(1, 2, 999, owner)).rejects.toBeInstanceOf(NotFoundError);
      expect(deleteExpenseRepo).not.toHaveBeenCalled();
    });
  });
});
