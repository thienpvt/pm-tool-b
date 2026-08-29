import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb, testPool } from '@/test/db';
import { setupRepoTables, testDb, testKysely } from '@/test/repo-db';
import { runInTransactionOnPool } from '@/lib/db-tx';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => testDb()),
  runInTransaction: (fn: (client: import('pg').PoolClient) => Promise<unknown>) =>
    runInTransactionOnPool(testPool(), fn),
}));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import {
  findUserByUsername,
  setUserPasswordHash,
  userPasswordHash,
} from './auth.repo';

describe.skipIf(!hasTestDb)('auth.repo', () => {
  let userId: number;
  let username: string;

  beforeAll(async () => {
    await setupRepoTables();
    username = `auth-repo-${Date.now()}`;
    const pool = testPool();
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed INTEGER DEFAULT 0`,
    );
    const userRes = await pool.query<{ id: number }>(
      `INSERT INTO users (username, password_hash, display_name, status)
       VALUES ($1, $2, $3, 'active') RETURNING id`,
      [username, 'old-hash', 'Auth Repo User'],
    );
    userId = userRes.rows[0].id;
  });

  afterAll(async () => {
    const { closeTestPool } = await import('@/test/db');
    await closeTestPool();
  });

  it('findUserByUsername returns the seeded username (D-05)', async () => {
    const user = await findUserByUsername(username);
    expect(user?.username).toBe(username);
    expect(user?.password_hash).toBe('old-hash');
  });

  it('setUserPasswordHash then userPasswordHash returns the new hash', async () => {
    await setUserPasswordHash(userId, 'new-hash');
    const row = await userPasswordHash(userId);
    expect(row?.password_hash).toBe('new-hash');
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await findUserByUsername(username);
    expect(getKysely).toHaveBeenCalled();
  });
});
