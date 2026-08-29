import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '@/test/db';
import { seedProject, setupRepoTables, testDb, testKysely } from '@/test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import {
  createBudgetItem,
  createExpense,
  deleteBudgetItem,
  deleteExpense,
  getBudgetItemInProject,
  listBudgetItems,
  listExpensesByItem,
  updateBudgetItem,
} from './budget.repo';

describe.skipIf(!hasTestDb)('budget.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    projectId = await seedProject('Budget Suite');
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await listBudgetItems(projectId);
    expect(getKysely).toHaveBeenCalled();
  });

  it('creates an item and reads it back scoped to the project', async () => {
    const created = await createBudgetItem(projectId, {
      type: 'CAPEX', name: 'Servers', planned_amount: 1000,
    }) as { id: number };
    const rows = await listBudgetItems(projectId) as { id: number }[];
    expect(rows.map(r => r.id)).toContain(created.id);
  });

  it('does not list another project items', async () => {
    const other = await seedProject('Other Budget');
    await createBudgetItem(other, { type: 'OPEX', name: 'Theirs' });
    const rows = await listBudgetItems(projectId) as Record<string, string>[];
    expect(rows.map(r => r.name)).not.toContain('Theirs');
  });

  it('preserves decimal amounts exactly through create', async () => {
    const created = await createBudgetItem(projectId, {
      type: 'CAPEX', name: 'Precise', planned_amount: '1234.56',
    }) as Record<string, string>;
    // NUMERIC(15,2) comes back as a string from pg — the point is no rounding drift.
    expect(Number(created.planned_amount)).toBe(1234.56);
  });

  it('updates an item and returns the updated row', async () => {
    const created = await createBudgetItem(projectId, {
      type: 'CAPEX', name: 'Before', planned_amount: 10,
    }) as { id: number };
    const updated = await updateBudgetItem(projectId, created.id, {
      type: 'OPEX', name: 'After', planned_amount: 20,
    }) as Record<string, string>;
    expect(updated.name).toBe('After');
    expect(Number(updated.planned_amount)).toBe(20);
  });

  it('scopes update to the project: a foreign item is not modified', async () => {
    const other = await seedProject('Foreign Update Budget');
    const foreign = await createBudgetItem(other, {
      type: 'CAPEX', name: 'Foreign', planned_amount: 5,
    }) as { id: number };

    await updateBudgetItem(projectId, foreign.id, { type: 'OPEX', name: 'Hijacked' });

    const stillTheirs = await getBudgetItemInProject(other, foreign.id);
    expect(stillTheirs).toBeDefined();
    const rows = await listBudgetItems(other) as Record<string, string>[];
    expect(rows.find(r => Number(r.id) === foreign.id)!.name).toBe('Foreign');
  });

  it('syncs actual_amount to the sum of expenses on insert and delete', async () => {
    const item = await createBudgetItem(projectId, {
      type: 'CAPEX', name: 'Tracked', planned_amount: 500,
    }) as { id: number };

    await createExpense(projectId, item.id, { description: 'First', amount: 100 });
    const exp2 = await createExpense(projectId, item.id, { description: 'Second', amount: 50.25 }) as { id: number };

    let rows = await listBudgetItems(projectId) as Record<string, string>[];
    expect(Number(rows.find(r => Number(r.id) === item.id)!.actual_amount)).toBe(150.25);

    await deleteExpense(projectId, item.id, exp2.id);

    rows = await listBudgetItems(projectId) as Record<string, string>[];
    expect(Number(rows.find(r => Number(r.id) === item.id)!.actual_amount)).toBe(100);
  });

  it('lists expenses scoped to both item and project', async () => {
    const item = await createBudgetItem(projectId, { type: 'OPEX', name: 'WithExpenses' }) as { id: number };
    await createExpense(projectId, item.id, { description: 'Mine', amount: 7 });

    const rows = await listExpensesByItem(projectId, item.id) as Record<string, string>[];
    expect(rows.map(r => r.description)).toEqual(['Mine']);
  });

  it('deletes only within the scoping project', async () => {
    const other = await seedProject('Delete Scope Budget');
    const foreign = await createBudgetItem(other, { type: 'CAPEX', name: 'Safe' }) as { id: number };
    const result = await deleteBudgetItem(projectId, foreign.id);
    expect(result.changes).toBe(0);
  });
});
