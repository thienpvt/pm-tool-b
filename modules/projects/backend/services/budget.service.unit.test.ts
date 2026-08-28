import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  listBudgetItems,
  listExpenses,
  activityStats,
  createBudgetItemRepo,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  listBudgetItems: vi.fn(),
  listExpenses: vi.fn(),
  activityStats: vi.fn(),
  createBudgetItemRepo: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/modules/projects/backend/repositories/budget.repo', () => ({
  listBudgetItems,
  listExpenses,
  activityStats,
  createBudgetItem: createBudgetItemRepo,
}));

import { createBudgetItem, getBudgetOverview } from './budget.service';
import { ForbiddenError, ValidationError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  assertProjectWriteAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };

describe('budget.service', () => {
  it('getBudgetOverview groups expenses and rounds completion_pct', async () => {
    listBudgetItems.mockResolvedValue([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);
    listExpenses.mockResolvedValue([
      { id: 10, budget_item_id: 1, amount: 5 },
      { id: 11, budget_item_id: 1, amount: 7 },
      { id: 12, budget_item_id: 2, amount: 3 },
    ]);
    activityStats.mockResolvedValue({ avg_pct: 33.6, total: 4 });

    const result = await getBudgetOverview(7, owner);

    expect(result).toEqual({
      items: [
        {
          id: 1,
          name: 'A',
          expenses: [
            { id: 10, budget_item_id: 1, amount: 5 },
            { id: 11, budget_item_id: 1, amount: 7 },
          ],
        },
        {
          id: 2,
          name: 'B',
          expenses: [{ id: 12, budget_item_id: 2, amount: 3 }],
        },
      ],
      completion_pct: 34,
    });
    expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
  });

  it('getBudgetOverview does not call repositories when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(getBudgetOverview(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listBudgetItems).not.toHaveBeenCalled();
    expect(listExpenses).not.toHaveBeenCalled();
    expect(activityStats).not.toHaveBeenCalled();
  });

  it('createBudgetItem throws ValidationError for empty name', async () => {
    await expect(createBudgetItem(7, owner, { name: '  ', type: 'CAPEX' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(createBudgetItemRepo).not.toHaveBeenCalled();
  });

  it('createBudgetItem throws ValidationError for non-CAPEX/OPEX type', async () => {
    await expect(
      createBudgetItem(7, owner, { name: 'Item', type: 'OPEX2' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(createBudgetItemRepo).not.toHaveBeenCalled();
  });

  it('createBudgetItem asserts write access before creating', async () => {
    createBudgetItemRepo.mockResolvedValue({ id: 1, name: 'Item' });
    await createBudgetItem(7, owner, { name: 'Item', type: 'CAPEX' });
    expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
    expect(createBudgetItemRepo).toHaveBeenCalled();
  });

  it('createBudgetItem does not call the repository when write access is denied', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(
      createBudgetItem(7, foreign, { name: 'Item', type: 'CAPEX' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(createBudgetItemRepo).not.toHaveBeenCalled();
  });
});
