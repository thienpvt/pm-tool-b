import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '@/test/db';
import { seedProject, setupRepoTables, testDb, testKysely } from '@/test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import { createHoliday, deleteHoliday, findHolidayByDate, listHolidays } from './holidays.repo';

describe.skipIf(!hasTestDb)('holidays.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    projectId = await seedProject('Holidays Suite');
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await listHolidays(projectId);
    expect(getKysely).toHaveBeenCalled();
  });

  it('creates a holiday and reads it back', async () => {
    const created = await createHoliday(projectId, '2026-01-01', 'New Year') as { id: number };
    const rows = await listHolidays(projectId) as { id: number }[];
    expect(rows.map(r => r.id)).toContain(created.id);
  });

  it('does not read another project holidays', async () => {
    const other = await seedProject('Other Holidays');
    await createHoliday(other, '2026-03-03', 'Theirs');

    const rows = await listHolidays(projectId) as Record<string, string>[];
    expect(rows.map(r => r.name)).not.toContain('Theirs');
  });

  it('orders by date ascending, matching the route', async () => {
    const p = await seedProject('Ordered Holidays');
    await createHoliday(p, '2026-12-25', 'Later');
    await createHoliday(p, '2026-05-01', 'Earlier');

    const rows = await listHolidays(p) as Record<string, string>[];
    expect(rows.map(r => r.name)).toEqual(['Earlier', 'Later']);
  });

  it('finds an existing date, which is how the route returns 409', async () => {
    const p = await seedProject('Duplicate Holidays');
    await createHoliday(p, '2026-07-04', 'Independence');

    const existing = await findHolidayByDate(p, '2026-07-04');
    expect(existing).toBeTruthy();

    const absent = await findHolidayByDate(p, '2026-07-05');
    expect(absent).toBeUndefined();
  });

  it('scopes the duplicate lookup by project', async () => {
    const a = await seedProject('Holiday Scope A');
    const b = await seedProject('Holiday Scope B');
    await createHoliday(a, '2026-09-09', 'Only in A');

    expect(await findHolidayByDate(b, '2026-09-09')).toBeUndefined();
  });

  it('deletes only within the scoping project', async () => {
    const other = await seedProject('Delete Scope Holidays');
    const foreign = await createHoliday(other, '2026-11-11', 'Theirs') as { id: number };

    const result = await deleteHoliday(projectId, foreign.id);
    expect(result.changes).toBe(0);
  });
});
