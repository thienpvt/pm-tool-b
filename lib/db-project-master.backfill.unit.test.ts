import { beforeEach, describe, expect, it, vi } from 'vitest';

const { poolQuery, settingsFlagExists } = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  settingsFlagExists: vi.fn(),
}));

vi.mock('pg', () => ({
  Pool: vi.fn(() => ({ query: poolQuery })),
}));

import {
  PM_ASSIGNMENT_BACKFILL_FLAG,
  backfillPmAssignments,
  migrateProjectMaster,
} from './db-project-master';

describe('pm_assignment_backfill_v1 (D-14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    poolQuery.mockResolvedValue({ rows: [] });
  });

  it('exports pm_assignment_backfill_v1 flag key', () => {
    expect(PM_ASSIGNMENT_BACKFILL_FLAG).toBe('pm_assignment_backfill_v1');
  });

  it('inserts open primary from pm_email match with NOT EXISTS guard', async () => {
    let backfillSql = '';
    poolQuery.mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('project_pm_assignments')) {
        backfillSql = sql;
      }
      return { rows: [] };
    });

    await backfillPmAssignments({ query: poolQuery } as never);

    expect(backfillSql).toMatch(/INSERT INTO project_pm_assignments/);
    expect(backfillSql).toMatch(/NOT EXISTS/);
    expect(backfillSql).toMatch(/project_pm_assignments a WHERE a\.project_id = p\.id/);
    expect(backfillSql).toMatch(/LOWER\(u\.email\) = LOWER\(TRIM\(p\.pm_email\)\)/);
    expect(backfillSql).toMatch(/'primary'/);
    expect(backfillSql).toMatch(/CURRENT_DATE, NULL/);
  });

  it('skips second run when backfill flag already set', async () => {
    const queries: string[] = [];
    await backfillPmAssignments({
      query: async (sql: string, params?: unknown[]) => {
        queries.push(sql);
        if (
          sql.includes('SELECT 1 FROM settings') &&
          params?.[0] === PM_ASSIGNMENT_BACKFILL_FLAG
        ) {
          return { rows: [{ '?column?': 1 }] };
        }
        return { rows: [] };
      },
    } as never);

    expect(queries.some((q) => q.includes('INSERT INTO project_pm_assignments'))).toBe(false);
  });

  it('writes settings flag after backfill', async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    poolQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return { rows: [] };
    });

    await backfillPmAssignments({ query: poolQuery } as never);

    expect(
      calls.some(
        (c) =>
          c.sql.includes('INSERT INTO settings') &&
          c.params?.[0] === PM_ASSIGNMENT_BACKFILL_FLAG,
      ),
    ).toBe(true);
  });
});
