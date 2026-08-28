import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backfillUserRoles, ROLES_BACKFILL_FLAG } from './db-roles';
import type { Pool } from 'pg';

function createMockPool() {
  const flags = new Set<string>();
  const queries: string[] = [];

  const pool = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      queries.push(sql);
      if (/SELECT 1 FROM settings WHERE key/.test(sql)) {
        const key = params?.[0] as string;
        return { rows: flags.has(key) ? [{ x: 1 }] : [] };
      }
      if (/INSERT INTO settings/.test(sql)) {
        flags.add(params?.[0] as string);
        return { rows: [] };
      }
      return { rows: [] };
    }),
  } as unknown as Pool;

  return { pool, queries, flags };
}

describe('backfillUserRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts cpmo for break-glass users and pm for others, then writes roles_backfill_v1', async () => {
    const { pool, queries, flags } = createMockPool();

    await backfillUserRoles(pool);

    const insert = queries.find(q => q.includes('INSERT INTO user_roles'));
    expect(insert).toBeDefined();
    expect(insert).toMatch(/CASE WHEN u\.is_admin = 1 THEN 'cpmo' ELSE 'pm' END/);
    expect(insert).toMatch(/u\.company_id IS NOT NULL/);
    expect(insert).toMatch(/NOT EXISTS \(SELECT 1 FROM user_roles ur WHERE ur\.user_id = u\.id\)/);
    expect(insert).toMatch(/ON CONFLICT \(user_id, role\) DO NOTHING/);
    expect(flags.has(ROLES_BACKFILL_FLAG)).toBe(true);
  });

  it('does not UPDATE users or derive is_admin from roles (D-03)', async () => {
    const { pool, queries } = createMockPool();

    await backfillUserRoles(pool);

    expect(queries.some(q => /UPDATE users/.test(q))).toBe(false);
  });

  it('is a no-op on second run when roles_backfill_v1 flag is set (D-02)', async () => {
    const { pool, queries, flags } = createMockPool();
    flags.add(ROLES_BACKFILL_FLAG);

    await backfillUserRoles(pool);

    expect(queries.some(q => q.includes('INSERT INTO user_roles'))).toBe(false);
    expect(queries.some(q => /INSERT INTO settings.*roles_backfill_v1/.test(q))).toBe(false);
  });
});
