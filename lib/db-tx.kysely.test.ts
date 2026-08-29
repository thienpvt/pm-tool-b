import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hasTestDb, testPool } from '@/test/db';
import { seedCompany, setupRepoTables } from '@/test/repo-db';
import { runInTransactionOnPool } from '@/lib/db-tx';
import { getKysely } from '@/lib/db/kysely';

describe.skipIf(!hasTestDb)('runInTransactionOnPool kysely ALS', () => {
  let companyId: number;
  let actorId: number;

  beforeAll(async () => {
    await setupRepoTables();
    companyId = await seedCompany(`kysely-tx-${Date.now()}`);
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

  it('rolls back a Kysely insert when the callback throws', async () => {
    await expect(
      runInTransactionOnPool(testPool(), async () => {
        const db = await getKysely();
        await db
          .insertInto('audit_logs')
          .values({
            actor_id: actorId,
            company_id: companyId,
            entity_type: 'test',
            entity_id: 'rollback-kysely',
            action: 'create',
            before: null,
            after: null,
          })
          .execute();
        throw new Error('rollback-kysely');
      }),
    ).rejects.toThrow('rollback-kysely');

    const { rows } = await testPool().query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM audit_logs WHERE company_id = $1',
      [companyId],
    );
    expect(rows[0].count).toBe(0);
  });
});
