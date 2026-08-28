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

describe.skipIf(!hasTestDb)('migrateMappingTableTenancy — bug backfill', () => {
  beforeAll(async () => {
    await setupRepoTables();
    const pool = testPool();
    await pool.query('DROP TABLE IF EXISTS bug_import_mappings CASCADE');
    await pool.query(`
      CREATE TABLE bug_import_mappings (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        mappings_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(
      `INSERT INTO bug_import_mappings (name, mappings_json) VALUES ($1, $2)`,
      ['BugStandard', '{"col":"B"}'],
    );
    await seedCompany('Bug Backfill Co A');
    await seedCompany('Bug Backfill Co B');
    await pool.query(`DELETE FROM settings WHERE key = 'mapping_tenant_bug_import_mappings_v1'`);
    await migrateMappingTableTenancy(pool);
  });

  it('leaves no bug rows with NULL company_id after two-company backfill', async () => {
    const { rows } = await testPool().query(
      `SELECT COUNT(*)::int AS c FROM bug_import_mappings WHERE company_id IS NULL`,
    );
    expect(rows[0].c).toBe(0);
  });

  it('does not collapse all bug rows onto a single company', async () => {
    const { rows } = await testPool().query(
      `SELECT COUNT(DISTINCT company_id)::int AS c FROM bug_import_mappings`,
    );
    expect(rows[0].c).toBeGreaterThan(1);
  });

  it('gives each company a copy of the legacy bug template name', async () => {
    const { rows } = await testPool().query(
      `SELECT company_id, name FROM bug_import_mappings WHERE name = $1 ORDER BY company_id`,
      ['BugStandard'],
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const companyIds = rows.map(r => r.company_id);
    expect(new Set(companyIds).size).toBe(companyIds.length);
  });
});

describe.skipIf(!hasTestDb)('migrateMappingTableTenancy — jql preset backfill', () => {
  beforeAll(async () => {
    await setupRepoTables();
    const pool = testPool();
    await pool.query('DROP TABLE IF EXISTS jira_jql_presets CASCADE');
    await pool.query(`
      CREATE TABLE jira_jql_presets (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        jql TEXT NOT NULL,
        context TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(
      `INSERT INTO jira_jql_presets (name, jql, context) VALUES ($1, $2, $3)`,
      ['MyPreset', 'project = X', 'timeline'],
    );
    await seedCompany('JQL Backfill Co A');
    await seedCompany('JQL Backfill Co B');
    await pool.query(`DELETE FROM settings WHERE key = 'mapping_tenant_jira_jql_presets_v1'`);
    await migrateMappingTableTenancy(pool);
  });

  it('leaves no jql preset rows with NULL company_id after two-company backfill', async () => {
    const { rows } = await testPool().query(
      `SELECT COUNT(*)::int AS c FROM jira_jql_presets WHERE company_id IS NULL`,
    );
    expect(rows[0].c).toBe(0);
  });

  it('does not collapse all jql preset rows onto a single company', async () => {
    const { rows } = await testPool().query(
      `SELECT COUNT(DISTINCT company_id)::int AS c FROM jira_jql_presets`,
    );
    expect(rows[0].c).toBeGreaterThan(1);
  });

  it('gives each company a copy of the legacy preset name in the same context', async () => {
    const { rows } = await testPool().query(
      `SELECT company_id, name, context FROM jira_jql_presets
       WHERE name = $1 AND context = $2 ORDER BY company_id`,
      ['MyPreset', 'timeline'],
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const companyIds = rows.map(r => r.company_id);
    expect(new Set(companyIds).size).toBe(companyIds.length);
  });
});

describe.skipIf(!hasTestDb)('migrateMappingTableTenancy — sync mapping backfill', () => {
  beforeAll(async () => {
    await setupRepoTables();
    const pool = testPool();
    await pool.query('DROP TABLE IF EXISTS jira_sync_mappings CASCADE');
    await pool.query(`
      CREATE TABLE jira_sync_mappings (
        id SERIAL PRIMARY KEY,
        mappings_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(
      `INSERT INTO jira_sync_mappings (mappings_json) VALUES ($1)`,
      ['{"summary":"activity"}'],
    );
    await seedCompany('Sync Backfill Co A');
    await seedCompany('Sync Backfill Co B');
    await pool.query(`DELETE FROM settings WHERE key = 'mapping_tenant_jira_sync_mappings_v1'`);
    await migrateMappingTableTenancy(pool);
  });

  it('leaves no sync mapping rows with NULL company_id after two-company backfill', async () => {
    const { rows } = await testPool().query(
      `SELECT COUNT(*)::int AS c FROM jira_sync_mappings WHERE company_id IS NULL`,
    );
    expect(rows[0].c).toBe(0);
  });

  it('does not collapse all sync mapping rows onto a single company', async () => {
    const { rows } = await testPool().query(
      `SELECT COUNT(DISTINCT company_id)::int AS c FROM jira_sync_mappings`,
    );
    expect(rows[0].c).toBeGreaterThan(1);
  });

  it('gives each company a copy of the legacy sync mapping payload', async () => {
    const { rows } = await testPool().query(
      `SELECT company_id, mappings_json FROM jira_sync_mappings
       WHERE mappings_json = $1 ORDER BY company_id`,
      ['{"summary":"activity"}'],
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const companyIds = rows.map(r => r.company_id);
    expect(new Set(companyIds).size).toBe(companyIds.length);
  });
});
