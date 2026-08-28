import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { seedProject, setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import { UnknownColumnError } from '@/lib/repositories/_helpers';
import { MEETING_COLUMNS, createMeeting, deleteMeeting, listMeetings, updateMeeting } from './meetings.repo';

describe.skipIf(!hasTestDb)('meetings.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    projectId = await seedProject('meetings Suite');
  });

  it('creates a row and reads it back', async () => {
    const created = await createMeeting(projectId, { name: 'Standup', frequency: 'Daily' }) as { id: number };
    const rows = await listMeetings(projectId) as { id: number }[];
    expect(rows.map(r => r.id)).toContain(created.id);
  });

  it('does not read another project rows', async () => {
    const other = await seedProject('Other meetings');
    await createMeeting(other, { name: 'Theirs' });
    const rows = await listMeetings(projectId) as Record<string, string>[];
    expect(rows.map(r => r.name)).not.toContain('Theirs');
  });

  it('writes an allowlisted column and returns the updated row', async () => {
    const created = await createMeeting(projectId, { name: 'Standup', frequency: 'Daily' }) as { id: number };
    const updated = await updateMeeting(projectId, created.id, { name: 'Renamed' }) as Record<string, string>;
    expect(updated.name).toBe('Renamed');
  });

  it('rejects an unknown column and leaves the row unchanged', async () => {
    const created = await createMeeting(projectId, { name: 'Standup', frequency: 'Daily' }) as { id: number };
    await expect(updateMeeting(projectId, created.id, { project_id: 999 })).rejects.toThrow(UnknownColumnError);
    const rows = await listMeetings(projectId) as Record<string, unknown>[];
    expect((rows.find(r => r.id === created.id) as Record<string, string>).name).toBe('Standup');
  });

  it('excludes id and project_id from the allowlist', () => {
    expect(MEETING_COLUMNS).not.toContain('id');
    expect(MEETING_COLUMNS).not.toContain('project_id');
  });

  it('deletes only within the scoping project', async () => {
    const other = await seedProject('Delete Scope meetings');
    const foreign = await createMeeting(other, { name: 'Standup', frequency: 'Daily' }) as { id: number };
    const result = await deleteMeeting(projectId, foreign.id);
    expect(result.changes).toBe(0);
  });
});
