import { beforeAll, describe, expect, it } from 'vitest';
import { migrateMappingTableTenancy } from '@/lib/db-mapping-tenant';
import { hasTestDb, testPool } from '../test/db';
import { seedCompany, setupRepoTables } from '../test/repo-db';

describe.skipIf(!hasTestDb)('migrateMappingTableTenancy — timeline backfill', () => {
  beforeAll(async () => {
    await setupRepoTables();
    const pool = testPool();
    await pool.query('DROP TABLE IF EXISTS timeline_import_mappings CASCADE');
    await pool.query(`
      CREATE TABLE timeline_import_mappings (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        mappings_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(
      `INSERT INTO timeline_import_mappings (name, mappings_json) VALUES ($1, $2)`,
      ['Standard', '{"col":"A"}'],
    );
    await seedCompany('Backfill Co A');
    await seedCompany('Backfill Co B');
    await pool.query(`DELETE FROM settings WHERE key LIKE 'mapping_tenant_%'`);
    await migrateMappingTableTenancy(pool);
  });

  it('leaves no rows with NULL company_id after two-company backfill', async () => {
    const { rows } = await testPool().query(
      `SELECT COUNT(*)::int AS c FROM timeline_import_mappings WHERE company_id IS NULL`,
    );
    expect(rows[0].c).toBe(0);
  });

  it('does not collapse all rows onto a single company', async () => {
    const { rows } = await testPool().query(
      `SELECT COUNT(DISTINCT company_id)::int AS c FROM timeline_import_mappings`,
    );
    expect(rows[0].c).toBeGreaterThan(1);
  });

  it('gives each company a copy of the legacy template name', async () => {
    const { rows } = await testPool().query(
      `SELECT company_id, name FROM timeline_import_mappings WHERE name = $1 ORDER BY company_id`,
      ['Standard'],
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const companyIds = rows.map(r => r.company_id);
    expect(new Set(companyIds).size).toBe(companyIds.length);
  });
});
