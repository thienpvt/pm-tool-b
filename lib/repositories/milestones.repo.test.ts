import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { seedCompany, seedProject, setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import { createActivity } from './activities.repo';
import {
  cancelMilestone,
  createMilestone,
  linkEpic,
  listEpics,
  listMilestones,
  listOverdueMilestones,
  listUpcomingMilestones,
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
    const uniqueUser = `cancel-scope-user-${Date.now()}`;
    const { lastInsertRowid: userId } = await testDb().run(
      'INSERT INTO users (username, password_hash, display_name) VALUES (?,?,?)',
      uniqueUser, 'hash', 'Cancel Scope User',
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

  describe('dual-write plan_end and end_date (D-14)', () => {
    it('createMilestone with only end_date persists plan_end equal to that value', async () => {
      const created = await createMilestone(projectId, {
        name: 'Dual End',
        end_date: '2026-09-01',
      }) as Record<string, string>;

      expect(created.end_date).toBe('2026-09-01');
      expect(created.plan_end).toBe('2026-09-01');
    });

    it('createMilestone with plan_end also persists end_date', async () => {
      const created = await createMilestone(projectId, {
        name: 'Dual Plan',
        plan_end: '2026-09-15',
      }) as Record<string, string>;

      expect(created.plan_end).toBe('2026-09-15');
      expect(created.end_date).toBe('2026-09-15');
    });

    it('updateMilestone dual-writes plan_end and end_date', async () => {
      const created = await createMilestone(projectId, { name: 'Update Dual' }) as { id: number };
      const updated = await updateMilestone(projectId, created.id, {
        name: 'Update Dual',
        plan_end: '2026-10-01',
      }) as Record<string, string>;

      expect(updated.plan_end).toBe('2026-10-01');
      expect(updated.end_date).toBe('2026-10-01');
    });
  });

  describe('listUpcomingMilestones / listOverdueMilestones (D-03)', () => {
    const today = '2026-08-26';
    const windowEnd = '2026-09-02';

    async function seedCompanyProject(name: string, companyId: number) {
      return seedProject(name, { company_id: companyId });
    }

    it('includes planned rows whose effective end is within the 7-day window', async () => {
      const companyId = await seedCompany('Upcoming Co');
      const p = await seedCompanyProject('Upcoming Project', companyId);
      const todayMs = await createMilestone(p, { name: 'Due Today', plan_end: today }) as { id: number };
      const weekMs = await createMilestone(p, { name: 'Due Week', plan_end: windowEnd }) as { id: number };
      await createMilestone(p, { name: 'Due Later', plan_end: '2026-09-03' });

      const rows = await listUpcomingMilestones(companyId, today, windowEnd) as { id: number }[];
      const ids = rows.map(r => r.id);
      expect(ids).toContain(todayMs.id);
      expect(ids).toContain(weekMs.id);
      expect(ids).not.toContain(
        (await listMilestones(p) as { id: number; name: string }[]).find(r => r.name === 'Due Later')!.id,
      );
    });

    it('excludes completed and cancelled milestones', async () => {
      const companyId = await seedCompany('Status Co');
      const p = await seedCompanyProject('Status Project', companyId);
      await testDb().run(
        `INSERT INTO milestones (project_id, name, plan_end, status) VALUES (?, ?, ?, ?)`,
        p, 'Completed', today, 'completed',
      );
      await testDb().run(
        `INSERT INTO milestones (project_id, name, plan_end, status) VALUES (?, ?, ?, ?)`,
        p, 'Cancelled', today, 'cancelled',
      );

      const rows = await listUpcomingMilestones(companyId, today, windowEnd) as { name: string }[];
      expect(rows.map(r => r.name)).not.toContain('Completed');
      expect(rows.map(r => r.name)).not.toContain('Cancelled');
    });

    it('uses COALESCE(adjusted_end, plan_end) as effective end', async () => {
      const companyId = await seedCompany('Adjusted Co');
      const p = await seedCompanyProject('Adjusted Project', companyId);
      await testDb().run(
        `INSERT INTO milestones (project_id, name, plan_end, adjusted_end, status) VALUES (?, ?, ?, ?, 'planned')`,
        p, 'Adjusted Wins', '2026-09-10', today,
      );

      const rows = await listUpcomingMilestones(companyId, today, windowEnd) as { name: string }[];
      expect(rows.map(r => r.name)).toContain('Adjusted Wins');
    });

    it('excludes rows with null effective end from both lists', async () => {
      const companyId = await seedCompany('Null End Co');
      const p = await seedCompanyProject('Null End Project', companyId);
      await createMilestone(p, { name: 'No End' });

      expect(await listUpcomingMilestones(companyId, today, windowEnd)).toEqual([]);
      expect(await listOverdueMilestones(companyId, today)).toEqual([]);
    });

    it('listOverdueMilestones includes yesterday and excludes today', async () => {
      const companyId = await seedCompany('Overdue Co');
      const p = await seedCompanyProject('Overdue Project', companyId);
      const overdue = await createMilestone(p, { name: 'Overdue', plan_end: '2026-08-25' }) as { id: number };
      await createMilestone(p, { name: 'Due Today', plan_end: today });

      const rows = await listOverdueMilestones(companyId, today) as { id: number }[];
      expect(rows.map(r => r.id)).toContain(overdue.id);
      expect(rows).toHaveLength(1);
    });
  });
});
