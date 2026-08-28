import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb, testPool } from '../../test/db';
import { seedProject, setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import { UnknownColumnError } from './_helpers';
import { ESCALATION_COLUMNS, listEscalations, updateEscalation } from './escalations.repo';

/**
 * The escalations route exposes only GET and PUT — there is no POST or DELETE
 * handler, so this repository has no create/delete function to test. Rows are
 * seeded directly here rather than inventing a write path the app does not have.
 */
async function seedLevel(projectId: number, level: number, levelName: string): Promise<number> {
  const { rows } = await testPool().query(
    'INSERT INTO escalation_levels (project_id, level, level_name) VALUES ($1, $2, $3) RETURNING id',
    [projectId, level, levelName],
  );
  return rows[0].id as number;
}

describe.skipIf(!hasTestDb)('escalations.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    projectId = await seedProject('Escalations Suite');
  });

  it('reads levels ordered by level descending', async () => {
    await seedLevel(projectId, 1, 'Team Lead');
    await seedLevel(projectId, 3, 'Executive');
    await seedLevel(projectId, 2, 'Manager');

    const rows = await listEscalations(projectId) as { level: number }[];

    expect(rows.map(r => Number(r.level))).toEqual([3, 2, 1]);
  });

  it('does not read another project levels', async () => {
    const other = await seedProject('Other Escalations');
    await seedLevel(other, 9, 'Theirs');

    const rows = await listEscalations(projectId) as { level_name: string }[];

    expect(rows.map(r => r.level_name)).not.toContain('Theirs');
  });

  it('writes an allowlisted column and returns the updated row', async () => {
    const rowId = await seedLevel(projectId, 4, 'Before');

    const updated = await updateEscalation(projectId, rowId, { level_name: 'After' }) as { level_name: string };

    expect(updated.level_name).toBe('After');
  });

  it('rejects an unknown column and leaves the row unchanged', async () => {
    const rowId = await seedLevel(projectId, 5, 'Untouched');

    await expect(updateEscalation(projectId, rowId, { project_id: 999 })).rejects.toThrow(UnknownColumnError);

    const { rows } = await testPool().query(
      'SELECT level_name, project_id FROM escalation_levels WHERE id = $1',
      [rowId],
    );
    expect(rows[0].level_name).toBe('Untouched');
    expect(rows[0].project_id).toBe(projectId);
  });

  it('excludes id and project_id from the allowlist', () => {
    expect(ESCALATION_COLUMNS).not.toContain('id');
    expect(ESCALATION_COLUMNS).not.toContain('project_id');
  });

  it('does not update a row belonging to another project', async () => {
    const other = await seedProject('Escalation Scope');
    const foreign = await seedLevel(other, 6, 'Foreign');

    await updateEscalation(projectId, foreign, { level_name: 'Hijacked' });

    const { rows } = await testPool().query('SELECT level_name FROM escalation_levels WHERE id = $1', [foreign]);
    expect(rows[0].level_name).toBe('Foreign');
  });
});
