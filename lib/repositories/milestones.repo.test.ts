import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { seedProject, setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import { createActivity } from './activities.repo';
import {
  cancelMilestone,
  createMilestone,
  linkEpic,
  listEpics,
  listMilestones,
  unlinkEpic,
  updateMilestone,
} from './milestones.repo';

describe.skipIf(!hasTestDb)('milestones.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    projectId = await seedProject('Milestones Suite');
  });

  it('creates a milestone and reads it back scoped to the project', async () => {
    const created = await createMilestone(projectId, {
      name: 'M1', start_date: '2026-01-01', end_date: '2026-02-01',
    }) as { id: number; name: string };

    const rows = await listMilestones(projectId) as { id: number }[];
    expect(rows.map(r => r.id)).toContain(created.id);
  });

  it('does not read another project milestones', async () => {
    const other = await seedProject('Other Milestones');
    await createMilestone(other, { name: 'Theirs' });

    const rows = await listMilestones(projectId) as Record<string, string>[];
    expect(rows.map(r => r.name)).not.toContain('Theirs');
  });

  it('orders by start_date then id, matching the route', async () => {
    const p = await seedProject('Ordered Milestones');
    await createMilestone(p, { name: 'Later', start_date: '2026-06-01' });
    await createMilestone(p, { name: 'Earlier', start_date: '2026-03-01' });

    const rows = await listMilestones(p) as Record<string, string>[];
    expect(rows.map(r => r.name)).toEqual(['Earlier', 'Later']);
  });

  it('updates a milestone within the scoping project', async () => {
    const created = await createMilestone(projectId, { name: 'Before' }) as { id: number };
    const updated = await updateMilestone(projectId, created.id, {
      name: 'After', start_date: null, end_date: null,
    }) as Record<string, string>;

    expect(updated.name).toBe('After');
  });

  it('will not update a milestone belonging to another project', async () => {
    const other = await seedProject('Foreign Update Milestones');
    const foreign = await createMilestone(other, { name: 'Untouched' }) as { id: number };

    await updateMilestone(projectId, foreign.id, { name: 'Hijacked' });

    const rows = await listMilestones(other) as Record<string, string>[];
    expect(rows.find(r => Number(r.id) === foreign.id)?.name).toBe('Untouched');
  });

  it('cancelMilestone does not affect a milestone belonging to another project', async () => {
    const other = await seedProject('Cancel Scope Milestones');
    const foreign = await createMilestone(other, { name: 'Theirs' }) as { id: number };
    const { lastInsertRowid: userId } = await testDb().run(
      'INSERT INTO users (username, password_hash, display_name) VALUES (?,?,?)',
      'cancel-scope-user', 'hash', 'Cancel Scope User',
    );

    const result = await cancelMilestone(projectId, foreign.id, Number(userId));
    expect(result).toBeUndefined();

    const rows = await listMilestones(other) as Record<string, string>[];
    const row = rows.find(r => Number(r.id) === foreign.id);
    expect(row?.name).toBe('Theirs');
    expect(row?.status ?? 'planned').toBe('planned');
  });

  it('links an epic, lists it, and is idempotent on a repeat link', async () => {
    const milestone = await createMilestone(projectId, { name: 'Epic Holder' }) as { id: number };
    const activity = await createActivity(projectId, { activity: 'Build it' }) as { id: number };

    await linkEpic(milestone.id, activity.id);
    await linkEpic(milestone.id, activity.id); // INSERT OR IGNORE — must not throw or duplicate

    const epics = await listEpics(milestone.id) as { id: number }[];
    expect(epics.filter(e => e.id === activity.id)).toHaveLength(1);
  });

  it('unlinks an epic', async () => {
    const milestone = await createMilestone(projectId, { name: 'Unlink Holder' }) as { id: number };
    const activity = await createActivity(projectId, { activity: 'Temporary' }) as { id: number };

    await linkEpic(milestone.id, activity.id);
    await unlinkEpic(milestone.id, activity.id);

    const epics = await listEpics(milestone.id) as { id: number }[];
    expect(epics.map(e => e.id)).not.toContain(activity.id);
  });
});
