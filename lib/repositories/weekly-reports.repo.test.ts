import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasTestDb, testPool } from '@/test/db';
import { seedCompany, seedProject, setupRepoTables, testDb } from '@/test/repo-db';
import { migrateWeeklyReports } from '@/lib/db-weekly-reports';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import { getShellsForPeriod } from './weekly-reports.repo';
import { createPeriodWithShells } from './weekly-periods.repo';

describe.skipIf(!hasTestDb)('weekly-reports.repo', () => {
  let companyId: number;

  beforeAll(async () => {
    await setupRepoTables();
    const pool = testPool();
    await migrateWeeklyReports(pool);
    companyId = await seedCompany(`weekly-reports-${Date.now()}`);
  });

  afterAll(async () => {
    const { closeTestPool } = await import('@/test/db');
    await closeTestPool();
  });

  beforeEach(async () => {
    const pool = testPool();
    await pool.query(
      'DELETE FROM weekly_reports WHERE period_id IN (SELECT id FROM weekly_periods WHERE company_id = $1)',
      [companyId],
    );
    await pool.query('DELETE FROM weekly_periods WHERE company_id = $1', [companyId]);
    await pool.query('DELETE FROM projects WHERE company_id = $1', [companyId]);
  });

  async function insertProject(name: string) {
    return seedProject(name, {
      company_id: companyId,
      weekly_report_enabled: true,
      weekly_report_start_period: '2026-W01',
      stage: 'L3',
      status: 'Active',
    });
  }

  it('UNIQUE (period_id, project_id) prevents duplicate shells (D-04)', async () => {
    await insertProject('p1');
    await insertProject('p2');

    const period = await createPeriodWithShells(companyId, '2026-W01', 1);
    expect(period.shells).toHaveLength(2);

    const shells = await getShellsForPeriod(period.id);
    expect(shells).toHaveLength(2);
    const projectIds = shells.map((s) => s.project_id).sort();
    expect(new Set(projectIds).size).toBe(2);
  });
});
