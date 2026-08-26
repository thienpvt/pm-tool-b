import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasTestDb, testPool } from '@/test/db';
import { seedCompany, seedProject, seedUser, setupRepoTables, testDb } from '@/test/repo-db';
import { migrateWeeklyReports } from '@/lib/db-weekly-reports';
import { runInTransactionOnPool } from '@/lib/db-tx';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => testDb()),
  runInTransaction: (fn: (client: import('pg').PoolClient) => Promise<unknown>) =>
    runInTransactionOnPool(testPool(), fn),
}));

import { insertWeeklyExportLog } from './weekly-export.repo';

describe.skipIf(!hasTestDb)('weekly-export.repo', () => {
  let companyId: number;
  let userId: number;
  let periodId: number;

  beforeAll(async () => {
    await setupRepoTables();
    const pool = testPool();
    await migrateWeeklyReports(pool);
    companyId = await seedCompany(`weekly-export-${Date.now()}`);
    userId = await seedUser(`exporter-${Date.now()}`, companyId);
    const projectId = await seedProject('Export Project', { company_id: companyId });
    const periodRes = await pool.query<{ id: number }>(
      `INSERT INTO weekly_periods (company_id, iso_week, start_date, end_date, due_at, display_name, config_snapshot)
       VALUES ($1, '2026-W01', '2025-12-29', '2026-01-04', '2026-01-03T18:00:00Z', '2026-W01', '{}'::jsonb)
       RETURNING id`,
      [companyId],
    );
    periodId = periodRes.rows[0].id;
    await pool.query(
      `INSERT INTO weekly_reports (period_id, project_id, status, latest_version)
       VALUES ($1, $2, 'submitted', 1)`,
      [periodId, projectId],
    );
  });

  afterAll(async () => {
    const { closeTestPool } = await import('@/test/db');
    await closeTestPool();
  });

  beforeEach(async () => {
    await testPool().query('DELETE FROM weekly_export_logs WHERE company_id = $1', [companyId]);
  });

  it('insertWeeklyExportLog appends a row with project_ids JSON (D-09)', async () => {
    const id = await insertWeeklyExportLog({
      period_id: periodId,
      company_id: companyId,
      exported_by: userId,
      format: 'xlsx',
      data_version: 3,
      project_ids: [100, 101],
      period_display_name: '2026-W01',
    });

    expect(id).toBeGreaterThan(0);

    const row = await testPool().query<{
      format: string;
      data_version: number;
      project_ids: number[];
      period_display_name: string;
    }>(
      'SELECT format, data_version, project_ids, period_display_name FROM weekly_export_logs WHERE id = $1',
      [id],
    );

    expect(row.rows[0]).toMatchObject({
      format: 'xlsx',
      data_version: 3,
      project_ids: [100, 101],
      period_display_name: '2026-W01',
    });
  });
});
