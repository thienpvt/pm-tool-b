import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasTestDb, testPool } from '@/test/db';
import { seedCompany, setupRepoTables, testDb, testKysely } from '@/test/repo-db';
import { runInTransactionOnPool } from '@/lib/db-tx';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => testDb()),
  runInTransaction: (fn: (client: import('pg').PoolClient) => Promise<unknown>) =>
    runInTransactionOnPool(testPool(), fn),
}));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import { insertAuditLog, listAuditLogs } from './audit.repo';

describe.skipIf(!hasTestDb)('audit.repo integration', () => {
  let companyId: number;
  let actorId: number;

  beforeAll(async () => {
    await setupRepoTables();
    companyId = await seedCompany(`audit-repo-${Date.now()}`);
    const pool = testPool();
    const unique = Date.now();
    const userRes = await pool.query(
      `INSERT INTO users (username, display_name, email, password_hash, company_id, status)
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id`,
      [`actor-${unique}`, 'Actor', `actor-${unique}@test.com`, 'hash', companyId],
    );
    actorId = userRes.rows[0].id as number;
  });

  afterAll(async () => {
    const { closeTestPool } = await import('@/test/db');
    await closeTestPool();
  });

  beforeEach(async () => {
    await testPool().query('DELETE FROM audit_logs WHERE company_id = $1', [companyId]);
  });

  it('returns both rows after two inserts for the same entity_id — first row unchanged (D-07)', async () => {
    await insertAuditLog({
      actor_id: actorId,
      company_id: companyId,
      entity_type: 'user',
      entity_id: '99',
      action: 'create',
      before: null,
      after: { username: 'alpha' },
    });
    await insertAuditLog({
      actor_id: actorId,
      company_id: companyId,
      entity_type: 'user',
      entity_id: '99',
      action: 'update',
      before: { username: 'alpha' },
      after: { username: 'beta' },
    });

    const rows = await listAuditLogs(companyId);
    expect(rows).toHaveLength(2);

    const firstInsert = rows.find(r => r.action === 'create')!;
    expect(firstInsert.actor_id).toBe(actorId);
    expect(firstInsert.before).toBeNull();
    expect(firstInsert.after).toEqual({ username: 'alpha' });
    expect(firstInsert.created_at).toBeTruthy();
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await listAuditLogs(companyId);
    expect(getKysely).toHaveBeenCalled();
  });
});
