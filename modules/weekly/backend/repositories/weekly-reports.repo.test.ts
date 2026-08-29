import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasTestDb, testPool } from '@/test/db';
import { seedCompany, seedProject, setupRepoTables, testDb, testKysely } from '@/test/repo-db';
import { migrateWeeklyReports } from '@/lib/db-weekly-reports';
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
  getShellsForPeriod,
  listPeriodShellsRepo,
  updateWeeklyReportDraft,
} from './weekly-reports.repo';
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
    await pool.query(
      'DELETE FROM project_pm_assignments WHERE project_id IN (SELECT id FROM projects WHERE company_id = $1)',
      [companyId],
    );
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

  it('listPeriodShellsRepo returns empty when companyId does not own the period (D-13)', async () => {
    await insertProject('p1');
    const period = await createPeriodWithShells(companyId, '2026-W01', 1);
    const foreignCompanyId = await seedCompany(`weekly-reports-foreign-${Date.now()}`);

    const rows = await listPeriodShellsRepo(foreignCompanyId, period.id);
    expect(rows).toEqual([]);
  });

  it('listPeriodShellsRepo includes project identity and active primary PM columns (D-03, D-13)', async () => {
    const pool = testPool();
    const projectId = await insertProject('Alpha');
    await pool.query(
      `UPDATE projects SET name = $1, project_code = $2, stage = $3 WHERE id = $4`,
      ['Alpha Project', 'AP-001', 'L3', projectId],
    );
    const unique = Date.now();
    const userRes = await pool.query(
      `INSERT INTO users (username, display_name, email, password_hash, company_id, status)
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id`,
      [`pm-${unique}`, 'Primary PM', `pm-${unique}@test.com`, 'hash', companyId],
    );
    const pmUserId = userRes.rows[0].id as number;
    await pool.query(
      `INSERT INTO project_pm_assignments (project_id, user_id, role, effective_from, effective_to)
       VALUES ($1, $2, 'primary', CURRENT_DATE, NULL)`,
      [projectId, pmUserId],
    );

    const period = await createPeriodWithShells(companyId, '2026-W01', 1);
    const rows = await listPeriodShellsRepo(companyId, period.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Alpha Project');
    expect(rows[0].project_code).toBe('AP-001');
    expect(rows[0].stage).toBe('L3');
    expect(rows[0].pm_user_id).toBe(pmUserId);
    expect(rows[0].pm_display_name).toBe('Primary PM');
  });

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

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await insertProject('p1');
    const period = await createPeriodWithShells(companyId, '2026-W01', 1);
    await listPeriodShellsRepo(companyId, period.id);
    expect(getKysely).toHaveBeenCalled();
  });

  it('updateWeeklyReportDraft persists highlights on shell (D-05)', async () => {
    const projectId = await insertProject('draft-p1');
    const period = await createPeriodWithShells(companyId, '2026-W01', 1);
    const shells = await getShellsForPeriod(period.id);
    const shell = shells.find((s) => s.project_id === projectId);
    expect(shell).toBeDefined();

    const updated = await updateWeeklyReportDraft(projectId, shell!.id, {
      highlights: 'Shipped milestone A',
      status: 'draft',
    });
    expect(updated?.highlights).toBe('Shipped milestone A');
    expect(updated?.status).toBe('draft');
  });

  it('writes via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    const projectId = await insertProject('write-p1');
    const period = await createPeriodWithShells(companyId, '2026-W02', 1);
    const shells = await getShellsForPeriod(period.id);
    const shell = shells.find((s) => s.project_id === projectId);
    await updateWeeklyReportDraft(projectId, shell!.id, { highlights: 'x' });
    expect(getKysely).toHaveBeenCalled();
  });
});
