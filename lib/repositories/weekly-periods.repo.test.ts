import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeTestPool, hasTestDb, testPool } from '@/test/db';
import {
  createPeriodWithShells,
  getCompanyWeeklyConfig,
  listObligatedProjectIds,
  upsertCompanyWeeklyConfig,
} from './weekly-periods.repo';
import { migrateWeeklyReports } from '@/lib/db-weekly-reports';
import { migrateProjectMaster } from '@/lib/db-project-master';

describe.skipIf(!hasTestDb)('weekly-periods.repo', () => {
  let companyId: number;

  beforeAll(async () => {
    const pool = testPool();
    await migrateProjectMaster(pool);
    await migrateWeeklyReports(pool);

    const companyRes = await pool.query(
      `INSERT INTO companies (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [`weekly-periods-test-${Date.now()}`],
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
    await pool.query('DELETE FROM company_weekly_config WHERE company_id = $1', [companyId]);
    await pool.query('DELETE FROM projects WHERE company_id = $1', [companyId]);
  });

  async function insertProject(overrides: Record<string, unknown> = {}) {
    const pool = testPool();
    const res = await pool.query(
      `INSERT INTO projects (name, company_id, weekly_report_enabled, weekly_report_start_period, stage, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        overrides.name ?? 'P',
        companyId,
        overrides.weekly_report_enabled ?? true,
        overrides.weekly_report_start_period ?? '2026-W01',
        overrides.stage ?? 'L3',
        overrides.status ?? 'Active',
      ],
    );
    return res.rows[0].id as number;
  }

  it('listObligatedProjectIds excludes disabled, L5, terminal, and future start_period (D-04)', async () => {
    await insertProject({ name: 'obligated' });
    await insertProject({ name: 'disabled', weekly_report_enabled: false });
    await insertProject({ name: 'l5', stage: 'L5' });
    await insertProject({ name: 'completed', status: 'Completed' });
    await insertProject({ name: 'future', weekly_report_start_period: '2026-W99' });

    const ids = await listObligatedProjectIds(companyId, '2026-W01');
    expect(ids).toHaveLength(1);
  });

  it('createPeriodWithShells inserts shells for obligated projects only (WKRP-01)', async () => {
    const p1 = await insertProject({ name: 'p1' });
    const p2 = await insertProject({ name: 'p2', weekly_report_enabled: false });

    const period = await createPeriodWithShells(companyId, '2026-W01', 1);
    expect(period.shells.map((s) => s.project_id).sort()).toEqual([p1].sort());
    expect(period.shells.find((s) => s.project_id === p2)).toBeUndefined();
  });

  it('upsertCompanyWeeklyConfig does not UPDATE existing period due_at (D-03, PERD-02)', async () => {
    await insertProject({ name: 'p1' });
    const period = await createPeriodWithShells(companyId, '2026-W01', 1);
    const originalDueAt = period.due_at;

    await upsertCompanyWeeklyConfig(companyId, { due_weekday: 1, due_time_utc: '12:00:00', updated_by: 1 });

    const pool = testPool();
    const row = await pool.query('SELECT due_at, config_snapshot FROM weekly_periods WHERE id = $1', [period.id]);
    expect(row.rows[0].due_at.toISOString()).toBe(new Date(originalDueAt).toISOString());
    expect(row.rows[0].config_snapshot.due_weekday).toBe(5);
  });

  it('getCompanyWeeklyConfig returns null when no row', async () => {
    const config = await getCompanyWeeklyConfig(companyId);
    expect(config).toBeNull();
  });
});
