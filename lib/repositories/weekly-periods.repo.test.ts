import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasTestDb, testPool } from '@/test/db';
import { seedCompany, seedProject, setupRepoTables, testDb } from '@/test/repo-db';
import { migrateWeeklyReports } from '@/lib/db-weekly-reports';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import {
  createPeriodWithShells,
  getCompanyWeeklyConfig,
  listObligatedProjectIds,
  upsertCompanyWeeklyConfig,
} from './weekly-periods.repo';

describe.skipIf(!hasTestDb)('weekly-periods.repo', () => {
  let companyId: number;

  beforeAll(async () => {
    await setupRepoTables();
    const pool = testPool();
    await migrateWeeklyReports(pool);
    companyId = await seedCompany(`weekly-periods-${Date.now()}`);
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
    await pool.query('DELETE FROM company_weekly_config WHERE company_id = $1', [companyId]);
    await pool.query('DELETE FROM projects WHERE company_id = $1', [companyId]);
  });

  async function insertProject(overrides: Record<string, unknown> = {}) {
    return seedProject(String(overrides.name ?? 'P'), {
      company_id: companyId,
      weekly_report_enabled: overrides.weekly_report_enabled ?? true,
      weekly_report_start_period: overrides.weekly_report_start_period ?? '2026-W01',
      stage: overrides.stage ?? 'L3',
      status: overrides.status ?? 'Active',
    });
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
    const originalDueAt = new Date(period.due_at).toISOString();

    await upsertCompanyWeeklyConfig(companyId, {
      due_weekday: 1,
      due_time_utc: '12:00:00',
      updated_by: 1,
    });

    const pool = testPool();
    const row = await pool.query('SELECT due_at, config_snapshot FROM weekly_periods WHERE id = $1', [
      period.id,
    ]);
    expect(new Date(row.rows[0].due_at).toISOString()).toBe(originalDueAt);
    expect(row.rows[0].config_snapshot.due_weekday).toBe(5);
  });

  it('getCompanyWeeklyConfig returns null when no row', async () => {
    const config = await getCompanyWeeklyConfig(companyId);
    expect(config).toBeNull();
  });
});
