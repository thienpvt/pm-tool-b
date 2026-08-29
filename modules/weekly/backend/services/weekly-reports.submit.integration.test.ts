import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasTestDb, testPool } from '@/test/db';
import { seedCompany, seedProject, setupRepoTables, testDb, testKysely } from '@/test/repo-db';
import { migrateWeeklyReports } from '@/lib/db-weekly-reports';
import { runInTransactionOnPool } from '@/lib/db-tx';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => testDb()),
  getPool: vi.fn(async () => testPool()),
  runInTransaction: (fn: (client: import('pg').PoolClient) => Promise<unknown>) =>
    runInTransactionOnPool(testPool(), fn),
}));
vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

vi.mock('@/lib/services/access', () => ({
  assertCompanyWrite: vi.fn(),
  assertProjectAccess: vi.fn(async () => ({ company_id: 1, customer_company_id: null })),
  assertProjectWriteAccess: vi.fn(),
  isCpmo: () => true,
}));

vi.mock('@/modules/audit/backend/services/audit.service', () => ({ auditLog: vi.fn() }));

vi.mock('@/modules/weekly/backend/repositories/weekly-reports.repo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/weekly/backend/repositories/weekly-reports.repo')>();
  return {
    ...actual,
    insertWeeklyReportVersion: vi.fn(async () => {
      throw new Error('version insert failed');
    }),
  };
});

import { createPeriodWithShells } from '@/modules/weekly/backend/repositories/weekly-periods.repo';
import { submitWeeklyReport } from './weekly-reports.service';
import type { AccessActor } from '@/lib/services/access';

describe.skipIf(!hasTestDb)('submitWeeklyReport transaction', () => {
  let companyId: number;
  const actor: AccessActor = {
    company_id: 0,
    is_admin: 0,
    roles: ['pm'],
    status: 'active',
    user_id: 1,
    username: 'pm',
    display_name: 'PM',
    email: 'pm@acme.com',
  };

  beforeAll(async () => {
    await setupRepoTables();
    await migrateWeeklyReports(testPool());
    companyId = await seedCompany(`weekly-submit-tx-${Date.now()}`);
    actor.company_id = companyId;
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
    await pool.query('DELETE FROM risks WHERE project_id IN (SELECT id FROM projects WHERE company_id = $1)', [
      companyId,
    ]);
    await pool.query('DELETE FROM projects WHERE company_id = $1', [companyId]);
  });

  it('rolls back RAID master writes when version insert fails (CR-02)', async () => {
    const projectId = await seedProject('tx-project', {
      company_id: companyId,
      weekly_report_enabled: true,
      weekly_report_start_period: '2026-W01',
      stage: 'L3',
      status: 'Active',
      rag: 'Green',
      progress_pct: 10,
    });
    const period = await createPeriodWithShells(companyId, '2026-W01', 1);
    const reportId = period.shells[0].id;

    await testDb().run(
      `UPDATE weekly_reports
       SET status = 'draft', this_week_rag = 'Green',
           draft_raid_json = ?::jsonb
       WHERE id = ?`,
      JSON.stringify({
        risks: [{ id: 'new', fields: { description: 'Orphan if not rolled back' } }],
        issues: [],
      }),
      reportId,
    );

    await expect(submitWeeklyReport(projectId, reportId, actor)).rejects.toThrow(
      'version insert failed',
    );

    const risks = await testPool().query('SELECT id FROM risks WHERE project_id = $1', [projectId]);
    expect(risks.rows).toHaveLength(0);

    const shell = await testPool().query(
      'SELECT status, latest_version FROM weekly_reports WHERE id = $1',
      [reportId],
    );
    expect(shell.rows[0].status).toBe('draft');
    expect(Number(shell.rows[0].latest_version)).toBe(0);
  });
});
