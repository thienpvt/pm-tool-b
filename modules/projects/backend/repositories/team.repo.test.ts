import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '@/test/db';
import { seedProject, setupRepoTables, testDb, testKysely } from '@/test/repo-db';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => testDb()),
}));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import { UnknownColumnError } from '@/lib/repositories/_helpers';
import { TEAM_COLUMNS, createTeamMember, deleteTeamMember, listTeam, updateTeamMember } from './team.repo';

describe.skipIf(!hasTestDb)('team.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    projectId = await seedProject('team Suite');
  });

  it('creates a row and reads it back', async () => {
    const created = await createTeamMember(projectId, { name: 'Ada', domain: 'Eng', email: 'ada@example.com' }) as { id: number };
    const rows = await listTeam(projectId) as { id: number }[];
    expect(rows.map(r => r.id)).toContain(created.id);
  });

  it('does not read another project rows', async () => {
    const other = await seedProject('Other team');
    await createTeamMember(other, { name: 'Theirs' });
    const rows = await listTeam(projectId) as Record<string, string>[];
    expect(rows.map(r => r.name)).not.toContain('Theirs');
  });

  it('writes an allowlisted column and returns the updated row', async () => {
    const created = await createTeamMember(projectId, { name: 'Ada', domain: 'Eng', email: 'ada@example.com' }) as { id: number };
    const updated = await updateTeamMember(projectId, created.id, { name: 'Renamed' }) as Record<string, string>;
    expect(updated.name).toBe('Renamed');
  });

  it('rejects an unknown column and leaves the row unchanged', async () => {
    const created = await createTeamMember(projectId, { name: 'Ada', domain: 'Eng', email: 'ada@example.com' }) as { id: number };
    await expect(updateTeamMember(projectId, created.id, { project_id: 999 })).rejects.toThrow(UnknownColumnError);
    const rows = await listTeam(projectId) as Record<string, unknown>[];
    expect((rows.find(r => r.id === created.id) as Record<string, string>).name).toBe('Ada');
  });

  it('persists the migration-added email column', async () => {
    const created = await createTeamMember(projectId, { name: 'Grace', email: 'grace@example.com' }) as { email: string };
    expect(created.email).toBe('grace@example.com');
    expect(TEAM_COLUMNS).toContain('email');
  });

  it('excludes id and project_id from the allowlist', () => {
    expect(TEAM_COLUMNS).not.toContain('id');
    expect(TEAM_COLUMNS).not.toContain('project_id');
  });

  it('deletes only within the scoping project', async () => {
    const other = await seedProject('Delete Scope team');
    const foreign = await createTeamMember(other, { name: 'Ada', domain: 'Eng', email: 'ada@example.com' }) as { id: number };
    const result = await deleteTeamMember(projectId, foreign.id);
    expect(result.changes).toBe(0);
  });
});
