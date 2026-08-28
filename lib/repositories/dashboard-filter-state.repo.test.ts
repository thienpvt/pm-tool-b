import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb, testPool } from '@/test/db';
import { setupRepoTables, testDb } from '@/test/repo-db';
import { migrateDashboards } from '@/lib/db-dashboards';
import { runInTransactionOnPool } from '@/lib/db-tx';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => testDb()),
  runInTransaction: (fn: (client: import('pg').PoolClient) => Promise<unknown>) =>
    runInTransactionOnPool(testPool(), fn),
}));

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDashboardFilters, upsertDashboardFilters } from './dashboard-filter-state.repo';

describe.skipIf(!hasTestDb)('dashboard-filter-state.repo', () => {
  let userId: number;

  beforeAll(async () => {
    await setupRepoTables();
    await migrateDashboards(testPool());
    const pool = testPool();
    const userRes = await pool.query<{ id: number }>(
      `INSERT INTO users (username, password_hash, display_name)
       VALUES ($1, 'hash', 'Filter User') RETURNING id`,
      [`filter-user-${Date.now()}`],
    );
    userId = userRes.rows[0].id;
  });

  afterAll(async () => {
    const { closeTestPool } = await import('@/test/db');
    await closeTestPool();
  });

  it('returns empty filters when no row exists (D-07)', async () => {
    const result = await getDashboardFilters(999_999, 'portfolio');
    expect(result).toEqual({ filters: {}, updated_at: null });
  });

  it('upsertDashboardFilters replaces filters_json for same (user_id, surface) (D-07, D-15)', async () => {
    await upsertDashboardFilters(userId, 'portfolio', { stage: 'L2' });
    const first = await getDashboardFilters(userId, 'portfolio');
    expect(first.filters).toEqual({ stage: 'L2' });
    expect(first.updated_at).not.toBeNull();

    await upsertDashboardFilters(userId, 'portfolio', { status: 'Active' });
    const second = await getDashboardFilters(userId, 'portfolio');
    expect(second.filters).toEqual({ status: 'Active' });
    expect(second.filters).not.toHaveProperty('stage');
  });

  it('portfolio and pm surfaces are independent for the same user (D-07)', async () => {
    const isolatedUser = userId + 1_000_000;
    const pool = testPool();
    await pool.query(
      `INSERT INTO users (username, password_hash, display_name)
       VALUES ($1, 'hash', 'Dual Surface')`,
      [`dual-surface-${Date.now()}`],
    );
    const res = await pool.query<{ id: number }>(
      `SELECT id FROM users WHERE username LIKE 'dual-surface-%' ORDER BY id DESC LIMIT 1`,
    );
    const uid = res.rows[0].id;

    await upsertDashboardFilters(uid, 'portfolio', { stage: 'L1' });
    await upsertDashboardFilters(uid, 'pm', { stage: 'L3' });

    const portfolio = await getDashboardFilters(uid, 'portfolio');
    const pm = await getDashboardFilters(uid, 'pm');
    expect(portfolio.filters).toEqual({ stage: 'L1' });
    expect(pm.filters).toEqual({ stage: 'L3' });
  });

  it('repo module has no physical DELETE of dashboard_filter_state (D-15)', () => {
    const src = readFileSync(resolve(__dirname, 'dashboard-filter-state.repo.ts'), 'utf8');
    expect(src).not.toMatch(/DELETE\s+FROM\s+dashboard_filter_state/i);
  });
});
