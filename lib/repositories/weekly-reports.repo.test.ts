import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeTestPool, hasTestDb, testPool } from '@/test/db';
import { getShellsForPeriod } from './weekly-reports.repo';
import { createPeriodWithShells } from './weekly-periods.repo';
import { migrateWeeklyReports } from '@/lib/db-weekly-reports';
import { migrateProjectMaster } from '@/lib/db-project-master';

describe.skipIf(!hasTestDb)('weekly-reports.repo', () => {
  let companyId: number;

  beforeAll(async () => {
    const pool = testPool();
    await migrateProjectMaster(pool);
    await migrateWeeklyReports(pool);

    const companyRes = await pool.query(
      `INSERT INTO companies (name) VALUES ($1) RETURNING id`,
      [`weekly-reports-test-${Date.now()}`],
    );
    companyId = companyRes.rows[0].id;
  });

  afterAll(async () => {
    await closeTestPool();
  });

  beforeEach(async () => {
    const pool = testPool();
    await pool.query('DELETE FROM weekly_reports WHERE period_id IN (SELECT id FROM weekly_periods WHERE company_id = $1)', [companyId]);
    await pool.query('DELETE FROM weekly_periods WHERE company_id = $1', [companyId]);
    await pool.query('DELETE FROM projects WHERE company_id = $1', [companyId]);
  });

  async function insertProject(name: string) {
    const pool = testPool();
    const res = await pool.query(
      `INSERT INTO projects (name, company_id, weekly_report_enabled, weekly_report_start_period, stage, status)
       VALUES ($1, $2, TRUE, '2026-W01', 'L3', 'Active') RETURNING id`,
      [name, companyId],
    );
    return res.rows[0].id as number;
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
