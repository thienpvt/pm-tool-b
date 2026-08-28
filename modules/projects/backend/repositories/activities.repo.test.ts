import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { seedProject, setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import { UnknownColumnError } from './_helpers';
import {
  ACTIVITY_COLUMNS,
  createActivity,
  deleteActivity,
  listActivities,
  maxOrderIdx,
  projectStatus,
  updateActivity,
} from './activities.repo';

describe.skipIf(!hasTestDb)('activities.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    projectId = await seedProject('Activities Suite', { status: 'In Progress' });
  });

  it('creates a row and lists it back scoped to the project', async () => {
    const created = await createActivity(projectId, { activity: 'Design', status: 'To-do' }) as { id: number };
    const rows = await listActivities(projectId) as { id: number }[];
    expect(rows.map(r => r.id)).toContain(created.id);
  });

  it('does not list another project rows', async () => {
    const other = await seedProject('Other Activities');
    await createActivity(other, { activity: 'Theirs' });
    const rows = await listActivities(projectId) as { activity: string }[];
    expect(rows.map(r => r.activity)).not.toContain('Theirs');
  });

  it('assigns order_idx as max + 1', async () => {
    const before = await maxOrderIdx(projectId);
    const created = await createActivity(projectId, { activity: 'Ordered' }) as { order_idx: number };
    expect(Number(created.order_idx)).toBe(before + 1);
  });

  it('falls back to the project status when project_status is omitted', async () => {
    const created = await createActivity(projectId, { activity: 'Fallback' }) as { project_status: string };
    expect(created.project_status).toBe(await projectStatus(projectId));
    expect(created.project_status).toBe('In Progress');
  });

  it('persists the migration-added columns project_status and parent_id', async () => {
    const parent = await createActivity(projectId, { activity: 'Parent' }) as { id: number };
    const child = await createActivity(projectId, {
      activity: 'Child', parent_id: parent.id, project_status: 'Custom',
    }) as { parent_id: number; project_status: string };
    expect(child.parent_id).toBe(parent.id);
    expect(child.project_status).toBe('Custom');
    expect(ACTIVITY_COLUMNS).toContain('project_status');
    expect(ACTIVITY_COLUMNS).toContain('parent_id');
  });

  it('writes an allowlisted column', async () => {
    const created = await createActivity(projectId, { activity: 'Before' }) as { id: number };
    const updated = await updateActivity(projectId, created.id, { activity: 'After' }) as { activity: string };
    expect(updated.activity).toBe('After');
  });

  it('rejects project_id and leaves the row unchanged', async () => {
    const created = await createActivity(projectId, { activity: 'Guarded' }) as { id: number };
    await expect(updateActivity(projectId, created.id, { project_id: 999 })).rejects.toThrow(UnknownColumnError);
    const rows = await listActivities(projectId) as { id: number }[];
    expect(rows.map(r => r.id)).toContain(created.id);
  });

  it('deletes only within the scoping project', async () => {
    const other = await seedProject('Delete Scope Activities');
    const foreign = await createActivity(other, { activity: 'Foreign' }) as { id: number };
    const res = await deleteActivity(projectId, foreign.id);
    expect(res.changes).toBe(0);
  });
});
