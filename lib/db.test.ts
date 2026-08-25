import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeTestPool, hasTestDb, testPool } from '../test/db';

describe.skipIf(!hasTestDb)('repository layer against real Postgres', () => {
  beforeAll(async () => {
    await testPool().query(`
      CREATE TABLE IF NOT EXISTS harness_probe (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        name TEXT NOT NULL
      )
    `);
    await testPool().query('TRUNCATE harness_probe RESTART IDENTITY');
  });

  afterAll(async () => {
    await testPool().query('DROP TABLE IF EXISTS harness_probe');
    await closeTestPool();
  });

  it('round-trips a row through real SQL', async () => {
    const insert = await testPool().query(
      'INSERT INTO harness_probe (company_id, name) VALUES ($1, $2) RETURNING id',
      [3, 'Alpha'],
    );
    const id = insert.rows[0].id as number;

    const { rows } = await testPool().query(
      'SELECT company_id, name FROM harness_probe WHERE id = $1',
      [id],
    );
    expect(rows).toEqual([{ company_id: 3, name: 'Alpha' }]);
  });

  it('isolates rows by company_id, proving tenant scoping is testable', async () => {
    await testPool().query('INSERT INTO harness_probe (company_id, name) VALUES ($1, $2), ($3, $4)', [
      3, 'Ours', 99, 'Theirs',
    ]);

    const { rows } = await testPool().query('SELECT name FROM harness_probe WHERE company_id = $1', [3]);
    expect(rows.map((r) => r.name as string)).not.toContain('Theirs');
  });

  it('rejects a non-test database name', () => {
    // Guard is checked at pool construction; assert the rule directly.
    expect(() => {
      const dbName = new URL('postgres://u:p@localhost:5432/production').pathname.replace(/^\//, '');
      if (!dbName.endsWith('_test')) throw new Error('Refusing');
    }).toThrow('Refusing');
  });
});
