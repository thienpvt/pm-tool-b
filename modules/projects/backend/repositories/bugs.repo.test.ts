import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { seedProject, setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import {
  deleteAllBugs,
  deleteSnapshot,
  latestSnapshotDate,
  listBugs,
  listSnapshotDates,
  replaceSnapshot,
} from './bugs.repo';

describe.skipIf(!hasTestDb)('bugs.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    projectId = await seedProject('Bugs Suite');
  });

  it('replaces a snapshot and lists it back', async () => {
    const bugs = [{ summary: 'Bug A', snapshot_date: '2026-01-01' }];
    const inserted = await replaceSnapshot(projectId, bugs, '2026-01-01');
    expect(inserted).toBe(1);

    const rows = await listBugs(projectId, '2026-01-01') as { summary: string }[];
    expect(rows.map(r => r.summary)).toContain('Bug A');
  });

  it('replaceSnapshot is idempotent: second call clears the first', async () => {
    await replaceSnapshot(projectId, [{ summary: 'Old' }], '2026-02-01');
    const inserted = await replaceSnapshot(projectId, [{ summary: 'New' }], '2026-02-01');
    expect(inserted).toBe(1);

    const rows = await listBugs(projectId, '2026-02-01') as { summary: string }[];
    expect(rows.map(r => r.summary)).toEqual(['New']);
  });

  it('listBugs without a date returns the latest snapshot', async () => {
    const p = await seedProject('Latest Snapshot');
    await replaceSnapshot(p, [{ summary: 'Old Snapshot' }], '2026-03-01');
    await replaceSnapshot(p, [{ summary: 'New Snapshot' }], '2026-04-01');

    const rows = await listBugs(p) as { summary: string }[];
    expect(rows.map(r => r.summary)).toContain('New Snapshot');
    expect(rows.map(r => r.summary)).not.toContain('Old Snapshot');
  });

  it('listBugs falls back to all rows when no snapshots exist', async () => {
    const p = await seedProject('No Snapshot');
    // Insert directly without a snapshot_date (empty string default)
    await testDb().run(
      'INSERT INTO bugs (project_id, summary, snapshot_date) VALUES (?, ?, ?)',
      p, 'Bare Row', '',
    );
    const rows = await listBugs(p) as { summary: string }[];
    expect(rows.map(r => r.summary)).toContain('Bare Row');
  });

  it('listSnapshotDates returns distinct dates with counts', async () => {
    const p = await seedProject('Snapshot Dates');
    await replaceSnapshot(p, [{ summary: 'X' }, { summary: 'Y' }], '2026-05-01');
    await replaceSnapshot(p, [{ summary: 'Z' }], '2026-06-01');

    const dates = await listSnapshotDates(p) as { snapshot_date: string; count: number }[];
    expect(dates).toHaveLength(2);
    const may = dates.find(d => d.snapshot_date === '2026-05-01');
    expect(Number(may?.count)).toBe(2);
  });

  it('does not read another project bugs', async () => {
    const other = await seedProject('Other Bugs');
    await replaceSnapshot(other, [{ summary: 'Theirs' }], '2026-07-01');

    const rows = await listBugs(projectId) as { summary: string }[];
    expect(rows.map(r => r.summary)).not.toContain('Theirs');
  });

  it('deleteSnapshot removes only that date', async () => {
    const p = await seedProject('Delete Snapshot');
    await replaceSnapshot(p, [{ summary: 'Keep' }], '2026-08-01');
    await replaceSnapshot(p, [{ summary: 'Gone' }], '2026-09-01');

    await deleteSnapshot(p, '2026-09-01');

    const rows = await listBugs(p, '2026-08-01') as { summary: string }[];
    expect(rows.map(r => r.summary)).toContain('Keep');
    expect(await listBugs(p, '2026-09-01')).toHaveLength(0);
  });

  it('deleteAllBugs removes all rows for the project', async () => {
    const p = await seedProject('Delete All Bugs');
    await replaceSnapshot(p, [{ summary: 'A' }], '2026-10-01');
    await deleteAllBugs(p);
    const latest = await latestSnapshotDate(p);
    expect(latest).toBeUndefined();
  });
});
